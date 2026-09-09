import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_SERVICE_URL ??= "http://localhost:4002";

const mockMemberFindUnique = vi.fn();
const mockChannelFindMany = vi.fn();
const mockChannelFindUnique = vi.fn();
const mockChannelCreate = vi.fn();
const mockChannelUpdate = vi.fn();
const mockChannelAggregate = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    roomMember: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
    },
    channel: {
      findMany: (...args: unknown[]) => mockChannelFindMany(...args),
      findUnique: (...args: unknown[]) => mockChannelFindUnique(...args),
      create: (...args: unknown[]) => mockChannelCreate(...args),
      update: (...args: unknown[]) => mockChannelUpdate(...args),
      aggregate: (...args: unknown[]) => mockChannelAggregate(...args),
    },
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const CHANNEL_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "owner-1";
const MEMBER_ID = "member-1";

describe("GET /rooms/:roomId/channels", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/rooms/${ROOM_ID}/channels`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-member", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });

  it("returns channels for a member, excluding archived ones", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    mockChannelFindMany.mockResolvedValue([
      { id: CHANNEL_ID, roomId: ROOM_ID, name: "general", isDefault: true, archivedAt: null },
    ]);
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.channels).toHaveLength(1);
    expect(mockChannelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: ROOM_ID, archivedAt: null } }),
    );
  });
});

describe("POST /rooms/:roomId/channels", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post(`/rooms/${ROOM_ID}/channels`).send({ name: "frontend" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-member (assertRoomOwner never discloses room existence)", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const token = signToken("stranger-1");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "frontend" });

    expect(res.status).toBe(404);
  });

  it("returns 403 for a member who is not the owner", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "frontend" });

    expect(res.status).toBe(403);
  });

  it("allows the owner to create a channel", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelAggregate.mockResolvedValue({ _max: { position: 0 } });
    mockChannelCreate.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
      name: "frontend",
      description: null,
      icon: null,
      position: 1,
      isDefault: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "frontend" });

    expect(res.status).toBe(201);
    expect(res.body.channel.name).toBe("frontend");
  });

  it("rejects an invalid channel name", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "Not A Valid Name!" });

    expect(res.status).toBe(400);
    expect(mockChannelCreate).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate channel name within the room", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelAggregate.mockResolvedValue({ _max: { position: 0 } });
    const { Prisma } = require("@prisma/client");
    mockChannelCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["roomId", "name"] },
      }),
    );
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/channels`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "general" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /rooms/:roomId/channels/:channelId", () => {
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
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .send({ name: "renamed" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner member", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "renamed" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the channel does not belong to this room", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: "other-room", isDefault: false });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "renamed" });

    expect(res.status).toBe(404);
  });

  it("blocks renaming the default (general) channel", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: ROOM_ID, name: "general", isDefault: true });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "renamed" });

    expect(res.status).toBe(400);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("blocks archiving the default (general) channel", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: ROOM_ID, name: "general", isDefault: true });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ archived: true });

    expect(res.status).toBe(400);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("allows the owner to rename a non-default channel", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: ROOM_ID, name: "frontend", isDefault: false });
    mockChannelUpdate.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
      name: "frontend-v2",
      description: null,
      icon: null,
      position: 1,
      isDefault: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ name: "frontend-v2" });

    expect(res.status).toBe(200);
    expect(res.body.channel.name).toBe("frontend-v2");
  });
});

describe("DELETE /rooms/:roomId/channels/:channelId (archive semantics)", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).delete(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner member", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it("blocks archiving the general channel", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: ROOM_ID, name: "general", isDefault: true });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(400);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("archives (never hard-deletes) a non-default channel for the owner", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockChannelFindUnique.mockResolvedValue({ id: CHANNEL_ID, roomId: ROOM_ID, name: "frontend", isDefault: false });
    mockChannelUpdate.mockResolvedValue({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
      name: "frontend",
      description: null,
      icon: null,
      position: 1,
      isDefault: false,
      archivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/channels/${CHANNEL_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(mockChannelUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CHANNEL_ID }, data: { archivedAt: expect.any(Date) } }),
    );
  });
});
