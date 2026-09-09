import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_SERVICE_URL ??= "http://localhost:4002";

const mockMemberFindUnique = vi.fn();
const mockMemberFindMany = vi.fn();
const mockRoomFindFirst = vi.fn();
const mockChannelFindUnique = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    roomMember: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
      findMany: (...args: unknown[]) => mockMemberFindMany(...args),
    },
    room: {
      findFirst: (...args: unknown[]) => mockRoomFindFirst(...args),
    },
    channel: {
      findUnique: (...args: unknown[]) => mockChannelFindUnique(...args),
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

describe("GET /internal/rooms/by-github-repository/:githubRepositoryId", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app).get("/internal/rooms/by-github-repository/123456");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an incorrect internal service secret", async () => {
    const res = await request(app)
      .get("/internal/rooms/by-github-repository/123456")
      .set("x-internal-service-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric githubRepositoryId", async () => {
    const res = await request(app)
      .get("/internal/rooms/by-github-repository/not-a-number")
      .set("x-internal-service-secret", "test-internal-secret");
    expect(res.status).toBe(400);
  });

  it("returns 404 when no room is associated with the repository", async () => {
    mockRoomFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/internal/rooms/by-github-repository/123456")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns the matching room with a valid internal secret", async () => {
    mockRoomFindFirst.mockResolvedValue({ id: ROOM_ID });

    const res = await request(app)
      .get("/internal/rooms/by-github-repository/123456")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ room: { roomId: ROOM_ID, githubRepositoryId: "123456" } });
  });

  it("looks up the room by GitHub's numeric repository id via the githubRepository relation, not by name", async () => {
    mockRoomFindFirst.mockResolvedValue(null);

    await request(app)
      .get("/internal/rooms/by-github-repository/123456")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(mockRoomFindFirst).toHaveBeenCalledWith({
      where: { githubRepository: { githubRepositoryId: BigInt(123456) } },
      select: { id: true },
    });
  });

  it("never includes room name, password hash, or member information in the response", async () => {
    mockRoomFindFirst.mockResolvedValue({ id: ROOM_ID });

    const res = await request(app)
      .get("/internal/rooms/by-github-repository/123456")
      .set("x-internal-service-secret", "test-internal-secret");

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password/i);
    expect(raw).not.toMatch(/member/i);
    expect(raw).not.toMatch(/secret/i);
  });
});

describe("POST /internal/rooms/:roomId/members/resolve", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .send({ usernames: ["alice"] });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed roomId", async () => {
    const res = await request(app)
      .post("/internal/rooms/not-a-uuid/members/resolve")
      .set("x-internal-service-secret", "test-internal-secret")
      .send({ usernames: ["alice"] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when usernames is missing or not an array", async () => {
    const res = await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .set("x-internal-service-secret", "test-internal-secret")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns an empty list without querying the database when usernames is empty", async () => {
    const res = await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .set("x-internal-service-secret", "test-internal-secret")
      .send({ usernames: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ members: [] });
    expect(mockMemberFindMany).not.toHaveBeenCalled();
  });

  it("resolves only usernames that belong to actual members of this room", async () => {
    mockMemberFindMany.mockResolvedValue([
      { user: { id: "user-1", username: "alice" } },
      { user: { id: "user-2", username: "bob" } },
    ]);

    const res = await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .set("x-internal-service-secret", "test-internal-secret")
      .send({ usernames: ["alice", "bob", "not-a-member"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      members: [
        { userId: "user-1", username: "alice" },
        { userId: "user-2", username: "bob" },
      ],
    });
  });

  it("scopes the lookup to this room and matches usernames case-insensitively", async () => {
    mockMemberFindMany.mockResolvedValue([]);

    await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .set("x-internal-service-secret", "test-internal-secret")
      .send({ usernames: ["Alice"] });

    expect(mockMemberFindMany).toHaveBeenCalledWith({
      where: {
        roomId: ROOM_ID,
        user: { username: { in: ["Alice"], mode: "insensitive" } },
      },
      select: { user: { select: { id: true, username: true } } },
    });
  });

  it("silently drops usernames that don't resolve to any member, rather than erroring", async () => {
    mockMemberFindMany.mockResolvedValue([]);

    const res = await request(app)
      .post(`/internal/rooms/${ROOM_ID}/members/resolve`)
      .set("x-internal-service-secret", "test-internal-secret")
      .send({ usernames: ["nobody-here"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ members: [] });
  });
});

describe("GET /internal/rooms/:roomId/channels/:channelId", () => {
  let app: ReturnType<typeof express>;
  const CHANNEL_ID = "33333333-3333-4333-8333-333333333333";

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app).get(`/internal/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed roomId/channelId", async () => {
    const res = await request(app)
      .get("/internal/rooms/not-a-uuid/channels/also-not-a-uuid")
      .set("x-internal-service-secret", "test-internal-secret");
    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns 404 when the channel belongs to a different room", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: "44444444-4444-4444-8444-444444444444",
      name: "general",
      isDefault: true,
      archivedAt: null,
    });

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns 404 when the channel is archived", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
      name: "old-project",
      isDefault: false,
      archivedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns the channel's id, name, and isDefault for a valid, non-archived channel in this room", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
      name: "general",
      isDefault: true,
      archivedAt: null,
    });

    const res = await request(app)
      .get(`/internal/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ channel: { id: CHANNEL_ID, name: "general", isDefault: true } });
  });
});
