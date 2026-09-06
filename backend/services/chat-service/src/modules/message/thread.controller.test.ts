import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";

const mockGetRoomMembership = vi.fn();
vi.mock("../room/roomServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../room/roomServiceClient.js")>(
    "../room/roomServiceClient.js",
  );
  return {
    ...actual,
    getRoomMembership: (...args: unknown[]) => mockGetRoomMembership(...args),
    resolveMentionedMembers: vi.fn().mockResolvedValue([]),
  };
});

const mockMessageFindUnique = vi.fn();
const mockMessageFindMany = vi.fn();
const mockMessageCreate = vi.fn();
const mockMessageUpdate = vi.fn();
const mockTransaction = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      findUnique: (...args: unknown[]) => mockMessageFindUnique(...args),
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
      // create/update are only ever called here as $transaction([...])
      // arguments (never awaited directly) — createReply builds both
      // "queries" first and hands them to the mocked $transaction below,
      // which is what actually resolves to the reply/parent pair.
      create: (...args: unknown[]) => mockMessageCreate(...args),
      update: (...args: unknown[]) => mockMessageUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockBroadcastMessageEvent = vi.fn();
vi.mock("../ws/wsServer", () => ({
  broadcastMessageEvent: (...args: unknown[]) => mockBroadcastMessageEvent(...args),
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const REPLY_ID = "33333333-3333-4333-8333-333333333333";

function parentMessage(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: PARENT_ID,
    roomId: ROOM_ID,
    userId: "user-1",
    content: "original message",
    parentMessageId: null,
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("POST /rooms/:roomId/messages/:messageId/replies", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .send({ content: "a reply" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not a room member", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the parent message does not exist", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(null);
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the parent message belongs to a different room", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(parentMessage({ roomId: "other-room" }));
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the parent message has already been deleted", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(parentMessage({ deletedAt: new Date() }));
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(404);
  });

  it("rejects replying to a message that is itself a reply (one level deep only)", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(parentMessage({ parentMessageId: "some-other-parent" }));
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(400);
  });

  it("creates a reply, increments the parent's replyCount, and broadcasts message.created", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(parentMessage());
    const now = new Date();
    const reply = {
      id: REPLY_ID,
      roomId: ROOM_ID,
      userId: "user-2",
      content: "a reply",
      parentMessageId: PARENT_ID,
      replyCount: 0,
      mentionedUserIds: [],
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    };
    mockTransaction.mockResolvedValue([reply, parentMessage({ replyCount: 1 })]);
    const token = signToken("user-2");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "a reply" });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({
      id: REPLY_ID,
      parentMessageId: PARENT_ID,
      content: "a reply",
    });
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.created", expect.objectContaining({ id: REPLY_ID }));
  });

  it("rejects blank reply content", async () => {
    const token = signToken("user-2");
    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(mockMessageFindUnique).not.toHaveBeenCalled();
  });
});

describe("GET /rooms/:roomId/messages/:messageId/replies", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not a room member", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("user-2");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the thread's parent message does not exist in this room", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(null);
    const token = signToken("user-2");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });

  it("returns replies for the thread in chronological order", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindUnique.mockResolvedValue(parentMessage());
    const now = new Date();
    mockMessageFindMany.mockResolvedValue([
      {
        id: "reply-1",
        roomId: ROOM_ID,
        userId: "user-2",
        content: "first reply",
        parentMessageId: PARENT_ID,
        replyCount: 0,
        mentionedUserIds: [],
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: null,
      },
    ]);
    const token = signToken("user-2");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/${PARENT_ID}/replies`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0]).toMatchObject({ id: "reply-1", parentMessageId: PARENT_ID });
    expect(mockMessageFindMany).toHaveBeenCalledWith({
      where: { parentMessageId: PARENT_ID },
      orderBy: { sequence: "asc" },
    });
  });
});
