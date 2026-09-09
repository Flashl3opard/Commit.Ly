import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_SERVICE_URL ??= "http://localhost:4002";

const mockMemberFindUnique = vi.fn();
const mockModuleFindMany = vi.fn();
const mockModuleFindUnique = vi.fn();
const mockModuleCreate = vi.fn();
const mockModuleUpdate = vi.fn();
const mockModuleDelete = vi.fn();
const mockModuleAggregate = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    roomMember: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
    },
    roomModule: {
      findMany: (...args: unknown[]) => mockModuleFindMany(...args),
      findUnique: (...args: unknown[]) => mockModuleFindUnique(...args),
      create: (...args: unknown[]) => mockModuleCreate(...args),
      update: (...args: unknown[]) => mockModuleUpdate(...args),
      delete: (...args: unknown[]) => mockModuleDelete(...args),
      aggregate: (...args: unknown[]) => mockModuleAggregate(...args),
    },
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const MODULE_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "owner-1";
const MEMBER_ID = "member-1";

describe("GET /rooms/:roomId/modules", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/rooms/${ROOM_ID}/modules`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-member", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const token = signToken("stranger-1");

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });

  it("returns modules (including disabled ones) for a member — members can use, not alter", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    mockModuleFindMany.mockResolvedValue([
      { id: MODULE_ID, roomId: ROOM_ID, type: "CHAT", name: "Chat", position: 0, enabled: true, config: null },
    ]);
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .get(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(1);
  });
});

describe("POST /rooms/:roomId/modules", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post(`/rooms/${ROOM_ID}/modules`).send({ type: "TASKS" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a member who is not the owner", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`])
      .send({ type: "TASKS" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-member (ownership check never discloses room existence)", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const token = signToken("stranger-1");

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`])
      .send({ type: "TASKS" });

    expect(res.status).toBe(404);
  });

  it("allows the owner to add an optional module (Tasks)", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleAggregate.mockResolvedValue({ _max: { position: 2 } });
    mockModuleCreate.mockResolvedValue({
      id: MODULE_ID,
      roomId: ROOM_ID,
      type: "TASKS",
      name: "Tasks",
      position: 3,
      enabled: true,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`])
      .send({ type: "TASKS" });

    expect(res.status).toBe(201);
    expect(res.body.module.type).toBe("TASKS");
  });

  it("rejects an invalid module type", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`])
      .send({ type: "NOT_A_REAL_MODULE" });

    expect(res.status).toBe(400);
    expect(mockModuleCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the room already has a module of this type", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleAggregate.mockResolvedValue({ _max: { position: 0 } });
    const { Prisma } = require("@prisma/client");
    mockModuleCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["roomId", "type"] },
      }),
    );
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .post(`/rooms/${ROOM_ID}/modules`)
      .set("Cookie", [`token=${token}`])
      .send({ type: "TASKS" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /rooms/:roomId/modules/:moduleId", () => {
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
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .send({ enabled: false });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner member", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ enabled: false });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the module does not belong to this room", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: "other-room", type: "TASKS" });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ enabled: false });

    expect(res.status).toBe(404);
  });

  it("blocks disabling the Chat module", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: ROOM_ID, type: "CHAT" });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ enabled: false });

    expect(res.status).toBe(400);
    expect(mockModuleUpdate).not.toHaveBeenCalled();
  });

  it("allows the owner to disable an optional module (Tasks)", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: ROOM_ID, type: "TASKS" });
    mockModuleUpdate.mockResolvedValue({
      id: MODULE_ID,
      roomId: ROOM_ID,
      type: "TASKS",
      name: "Tasks",
      position: 3,
      enabled: false,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.module.enabled).toBe(false);
  });

  it("allows the owner to reorder a module", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: ROOM_ID, type: "TASKS" });
    mockModuleUpdate.mockResolvedValue({
      id: MODULE_ID,
      roomId: ROOM_ID,
      type: "TASKS",
      name: "Tasks",
      position: 0,
      enabled: true,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .patch(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`])
      .send({ position: 0 });

    expect(res.status).toBe(200);
    expect(mockModuleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
    );
  });
});

describe("DELETE /rooms/:roomId/modules/:moduleId", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).delete(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-owner member", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER", joinedAt: new Date() });
    const token = signToken(MEMBER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it("blocks removing the Chat module", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: ROOM_ID, type: "CHAT" });
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(400);
    expect(mockModuleDelete).not.toHaveBeenCalled();
  });

  it("allows the owner to remove an optional module (Tasks)", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER", joinedAt: new Date() });
    mockModuleFindUnique.mockResolvedValue({ id: MODULE_ID, roomId: ROOM_ID, type: "TASKS" });
    mockModuleDelete.mockResolvedValue({});
    const token = signToken(OWNER_ID);

    const res = await request(app)
      .delete(`/rooms/${ROOM_ID}/modules/${MODULE_ID}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(mockModuleDelete).toHaveBeenCalledWith({ where: { id: MODULE_ID } });
  });
});
