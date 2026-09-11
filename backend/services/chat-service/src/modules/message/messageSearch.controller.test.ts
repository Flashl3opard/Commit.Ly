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

const mockMessageFindMany = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const ROOM_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /rooms/:roomId/messages/search", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/rooms/${ROOM_ID}/messages/search?q=hello`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not a room member", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=hello`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(403);
  });

  it("returns 400 for a missing or blank query", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(400);
  });

  it("returns matching messages for a member", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const now = new Date();
    mockMessageFindMany.mockResolvedValue([
      {
        id: "msg-1",
        roomId: ROOM_ID,
        userId: "user-1",
        senderType: "USER",
        systemEventType: null,
        metadata: null,
        content: "let's finish the authentication flow",
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: null,
      },
    ]);

    const token = signToken("user-1");
    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=authentication`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe("let's finish the authentication flow");
  });

  it("excludes soft-deleted messages from the query", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);

    const token = signToken("user-1");
    await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=deleted`)
      .set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("scopes the search to the given roomId", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);

    const token = signToken("user-1");
    await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=hello`)
      .set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roomId: ROOM_ID }),
      }),
    );
  });

  it("caps results at 25", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    mockMessageFindMany.mockResolvedValue([]);

    const token = signToken("user-1");
    await request(app)
      .get(`/rooms/${ROOM_ID}/messages/search?q=hello`)
      .set("Cookie", [`token=${token}`]);

    expect(mockMessageFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
