import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";

const mockGetRoomMembership = vi.fn();
const mockGetChannel = vi.fn();
vi.mock("../room/roomServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../room/roomServiceClient.js")>(
    "../room/roomServiceClient.js",
  );
  return {
    ...actual,
    getRoomMembership: (...args: unknown[]) => mockGetRoomMembership(...args),
    getChannel: (...args: unknown[]) => mockGetChannel(...args),
  };
});

const mockMessageCreate = vi.fn();
const mockMessageFindMany = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      create: (...args: unknown[]) => mockMessageCreate(...args),
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
  },
}));

const mockBroadcastMessageEvent = vi.fn();
vi.mock("../ws/wsServer", () => ({
  broadcastMessageEvent: (...args: unknown[]) => mockBroadcastMessageEvent(...args),
}));

import { encodeCursor } from "./cursor";

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const CHANNEL_ID = "99999999-9999-4999-8999-999999999999";

describe("POST /rooms/:roomId/messages", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Every test in this file targets a channel-scoped URL now, so a sane
  // default channel resolution avoids repeating this in every single test
  // — tests exercising the "channel not found" path override it directly.
  beforeEach(() => {
    mockGetChannel.mockResolvedValue({ id: CHANNEL_ID, name: "general", isDefault: true });
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).send({ content: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const expired = signToken("user-1", -10);
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${expired}`])
      .send({ content: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed room id", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/not-a-uuid/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hi" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed channel id", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/not-a-uuid/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hi" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when the user is not a room member", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("user-1");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hi" });

    expect(res.status).toBe(403);
    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
  });

  it("creates a message for a room member", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const now = new Date();
    mockMessageCreate.mockResolvedValue({
      id: "msg-uuid-1",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: "user-1",
      content: "Hello team",
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });
    const token = signToken("user-1");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "Hello team" });

    expect(res.status).toBe(201);
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.created", res.body.message);
    expect(res.body.message).toEqual({
      id: "msg-uuid-1",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: "user-1",
      senderType: "user",
      systemEventType: null,
      metadata: null,
      content: "Hello team",
      parentMessageId: null,
      replyCount: 0,
      mentionedUserIds: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      editedAt: null,
      deletedAt: null,
    });
  });

  it("rejects a blank message", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "" });

    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only message", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "     \n\t  " });

    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects content over 4000 characters", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a".repeat(4001) });

    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("accepts content at exactly the 4000 character limit", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const now = new Date();
    const content = "a".repeat(4000);
    mockMessageCreate.mockResolvedValue({
      id: "msg-uuid-2",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: "user-1",
      content,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });
    const token = signToken("user-1");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content });

    expect(res.status).toBe(201);
  });

  it("cannot have userId spoofed via the request body", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageCreate.mockResolvedValue({
      id: "msg-uuid-3",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: "user-1",
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
      editedAt: null,
      deletedAt: null,
    });
    const token = signToken("user-1");

    await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hi", userId: "someone-else", createdAt: "2020-01-01T00:00:00.000Z" });

    // .strict() rejects the extra fields entirely (400), so the create call
    // must never have happened with a spoofed identity.
    const createCall = mockMessageCreate.mock.calls[0]?.[0];
    if (createCall) {
      expect(createCall.data.userId).toBe("user-1");
    }
  });

  it("rejects extra/unexpected fields in the request body", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hi", userId: "someone-else" });

    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });
});

function fakeMessage(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: `msg-${overrides.sequence ?? "1"}`,
    roomId: ROOM_ID,
    channelId: CHANNEL_ID,
    userId: "user-1",
    content: `message ${overrides.sequence ?? "1"}`,
    sequence: BigInt((overrides.sequence as number) ?? 1),
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("GET /rooms/:roomId/messages", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetChannel.mockResolvedValue({ id: CHANNEL_ID, name: "general", isDefault: true });
  });

  // Every test in this file targets a channel-scoped URL now, so a sane
  // default channel resolution avoids repeating this in every single test
  // — tests exercising the "channel not found" path override it directly.
  beforeEach(() => {
    mockGetChannel.mockResolvedValue({ id: CHANNEL_ID, name: "general", isDefault: true });
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-member", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("user-1");

    const res = await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it("returns messages oldest -> newest with a member", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    // Prisma returns newest-first (sequence desc); the service reverses it.
    mockMessageFindMany.mockResolvedValue([fakeMessage({ sequence: 3 }), fakeMessage({ sequence: 2 }), fakeMessage({ sequence: 1 })]);
    const token = signToken("user-1");

    const res = await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
  });

  it("defaults to limit=50", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);
    const token = signToken("user-1");

    await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });

  it("respects a custom limit", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);
    const token = signToken("user-1");

    await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?limit=10`).set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 11 }));
  });

  it("excludes replies (parentMessageId set) from room history — they only ever appear in their thread's own reply list", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);
    const token = signToken("user-1");

    await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentMessageId: null }),
      }),
    );
  });

  it("enforces the maximum limit of 100", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?limit=500`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(400);
  });

  it("returns nextCursor when more messages exist, encoding the oldest returned sequence", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    // limit=2 requested -> service asks for 3; returning 3 signals "more exist".
    mockMessageFindMany.mockResolvedValue([
      fakeMessage({ sequence: 3 }),
      fakeMessage({ sequence: 2 }),
      fakeMessage({ sequence: 1 }),
    ]);
    const token = signToken("user-1");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?limit=2`)
      .set("Cookie", [`token=${token}`]);

    expect(res.body.messages).toHaveLength(2);
    expect(res.body.nextCursor).toBe(encodeCursor(2n));
  });

  it("returns nextCursor: null when no more messages exist", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([fakeMessage({ sequence: 1 })]);
    const token = signToken("user-1");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?limit=50`)
      .set("Cookie", [`token=${token}`]);

    expect(res.body.nextCursor).toBeNull();
  });

  it("passes the decoded cursor through as sequence: { lt: ... }", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);
    const token = signToken("user-1");
    const cursor = encodeCursor(5n);

    await request(app)
      .get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?before=${cursor}`)
      .set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sequence: { lt: 5n } }),
      }),
    );
  });

  it("returns 400 for an invalid cursor rather than crashing", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken("user-1");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages?before=not-a-valid-cursor!!!`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(400);
  });

  it("returns deleted messages as tombstones with content: null", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([
      fakeMessage({ sequence: 1, content: "this was deleted", deletedAt: new Date() }),
    ]);
    const token = signToken("user-1");

    const res = await request(app).get(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}/messages`).set("Cookie", [`token=${token}`]);

    expect(res.body.messages[0].content).toBeNull();
    expect(res.body.messages[0].deletedAt).not.toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("this was deleted");
  });
});
