import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";

const mockGetRoomMembership = vi.fn();
vi.mock("../room/roomServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../room/roomServiceClient.js")>(
    "../room/roomServiceClient.js",
  );
  return {
    ...actual,
    getRoomMembership: (...args: unknown[]) => mockGetRoomMembership(...args),
  };
});

const mockMessageFindUnique = vi.fn();
const mockMessageUpdate = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      findUnique: (...args: unknown[]) => mockMessageFindUnique(...args),
      update: (...args: unknown[]) => mockMessageUpdate(...args),
    },
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
const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "author-1";
const OTHER_MEMBER_ID = "other-member-1";

function existingMessage(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: MESSAGE_ID,
    roomId: ROOM_ID,
    userId: AUTHOR_ID,
    content: "original content",
    sequence: 1n,
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("PATCH /messages/:messageId", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).patch(`/messages/${MESSAGE_ID}`).send({ content: "updated" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed message id", async () => {
    const token = signToken(AUTHOR_ID);
    const res = await request(app)
      .patch("/messages/not-a-uuid")
      .set("Cookie", [`token=${token}`])
      .send({ content: "updated" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the message does not exist", async () => {
    mockMessageFindUnique.mockResolvedValue(null);
    const token = signToken(AUTHOR_ID);

    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "updated" });

    expect(res.status).toBe(404);
  });

  it("allows the author to edit their own message", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageUpdate.mockResolvedValue(existingMessage({ content: "updated content", editedAt: new Date() }));
    const token = signToken(AUTHOR_ID);

    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "updated content" });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe("updated content");
    expect(res.body.message.editedAt).not.toBeNull();
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.updated", res.body.message);
  });

  it("sets editedAt via the update call", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageUpdate.mockResolvedValue(existingMessage({ content: "updated", editedAt: new Date() }));
    const token = signToken(AUTHOR_ID);

    await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "updated" });

    const updateCall = mockMessageUpdate.mock.calls[0][0];
    expect(updateCall.data.content).toBe("updated");
    expect(updateCall.data.editedAt).toBeInstanceOf(Date);
  });

  it("blocks another room member from editing someone else's message", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(OTHER_MEMBER_ID);

    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hijacked" });

    expect(res.status).toBe(403);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });

  it("blocks a non-member from editing", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("non-member-1");

    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "hijacked" });

    expect(res.status).toBe(403);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });

  it("cannot edit an already-deleted message", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage({ deletedAt: new Date() }));
    const token = signToken(AUTHOR_ID);

    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "resurrected" });

    expect(res.status).toBe(404);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });

  it("rejects blank content", async () => {
    const token = signToken(AUTHOR_ID);
    const res = await request(app)
      .patch(`/messages/${MESSAGE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ content: "" });

    expect(res.status).toBe(400);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /messages/:messageId", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).delete(`/messages/${MESSAGE_ID}`);
    expect(res.status).toBe(401);
  });

  it("allows the author to delete their own message (soft delete)", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageUpdate.mockResolvedValue(
      existingMessage({ content: "original content", deletedAt: new Date() }),
    );
    const token = signToken(AUTHOR_ID);

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.message.deletedAt).not.toBeNull();
    // Soft delete: the update call only sets deletedAt, never removes the row.
    const updateCall = mockMessageUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: MESSAGE_ID });
    expect(updateCall.data).toEqual({ deletedAt: expect.any(Date) });
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.deleted", res.body.message);
  });

  it("never returns the original content after deletion", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageUpdate.mockResolvedValue(
      existingMessage({ content: "sensitive original text", deletedAt: new Date() }),
    );
    const token = signToken(AUTHOR_ID);

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.body.message.content).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("sensitive original text");
  });

  it("blocks another room member from deleting someone else's message", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(OTHER_MEMBER_ID);

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });

  it("blocks a non-member from deleting", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage());
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("non-member-1");

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the message does not exist", async () => {
    mockMessageFindUnique.mockResolvedValue(null);
    const token = signToken(AUTHOR_ID);

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });

  it("documented policy: deleting an already-deleted message returns 404 (not idempotent 200)", async () => {
    mockMessageFindUnique.mockResolvedValue(existingMessage({ deletedAt: new Date() }));
    const token = signToken(AUTHOR_ID);

    const res = await request(app).delete(`/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
    expect(mockMessageUpdate).not.toHaveBeenCalled();
  });
});
