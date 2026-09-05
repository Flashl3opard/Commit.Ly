import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_SERVICE_URL ??= "http://localhost:4002";

const mockMemberFindUnique = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    roomMember: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
    },
  },
}));

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("GET /internal/rooms/:roomId/members/:userId", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app).get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 with an incorrect internal service secret", async () => {
    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`)
      .set("x-internal-service-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed roomId/userId", async () => {
    const res = await request(app)
      .get("/internal/rooms/not-a-uuid/members/also-not-a-uuid")
      .set("x-internal-service-secret", "test-internal-secret");
    expect(res.status).toBe(400);
  });

  it("returns 404 when the user is not a member", async () => {
    mockMemberFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns the member's role and joinedAt with a valid internal secret", async () => {
    const joinedAt = new Date("2026-01-01T00:00:00.000Z");
    mockMemberFindUnique.mockResolvedValue({
      id: "member-uuid-1",
      roomId: ROOM_ID,
      userId: USER_ID,
      role: "MEMBER",
      joinedAt,
    });

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      membership: { role: "MEMBER", joinedAt: joinedAt.toISOString() },
    });
  });

  it("queries membership using the exact roomId_userId compound key", async () => {
    mockMemberFindUnique.mockResolvedValue(null);

    await request(app)
      .get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(mockMemberFindUnique).toHaveBeenCalledWith({
      where: { roomId_userId: { roomId: ROOM_ID, userId: USER_ID } },
    });
  });

  it("never includes password hashes, full member lists, or secrets in the response", async () => {
    mockMemberFindUnique.mockResolvedValue({
      id: "member-uuid-1",
      roomId: ROOM_ID,
      userId: USER_ID,
      role: "OWNER",
      joinedAt: new Date(),
    });

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/members/${USER_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password/i);
    expect(raw).not.toMatch(/secret/i);
  });
});
