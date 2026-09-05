import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcrypt";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_SERVICE_URL ??= "http://localhost:4002";

const mockGetRepositoryById = vi.fn();
vi.mock("../github/githubServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../github/githubServiceClient.js")>(
    "../github/githubServiceClient.js",
  );
  return {
    ...actual,
    getRepositoryById: (...args: unknown[]) => mockGetRepositoryById(...args),
  };
});

const mockGetPublicProfile = vi.fn();
vi.mock("../user/userServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../user/userServiceClient.js")>(
    "../user/userServiceClient.js",
  );
  return {
    ...actual,
    getPublicProfile: (...args: unknown[]) => mockGetPublicProfile(...args),
  };
});

const mockRoomFindUnique = vi.fn();
const mockRoomFindMany = vi.fn();
const mockRoomCreate = vi.fn();
const mockRoomDelete = vi.fn();
const mockMemberFindUnique = vi.fn();
const mockMemberFindMany = vi.fn();
const mockMemberCreate = vi.fn();
const mockMemberDelete = vi.fn();
const mockMemberDeleteMany = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    room: {
      findUnique: (...args: unknown[]) => mockRoomFindUnique(...args),
      findMany: (...args: unknown[]) => mockRoomFindMany(...args),
      create: (...args: unknown[]) => mockRoomCreate(...args),
      delete: (...args: unknown[]) => mockRoomDelete(...args),
    },
    roomMember: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
      findMany: (...args: unknown[]) => mockMemberFindMany(...args),
      create: (...args: unknown[]) => mockMemberCreate(...args),
      delete: (...args: unknown[]) => mockMemberDelete(...args),
      deleteMany: (...args: unknown[]) => mockMemberDeleteMany(...args),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        const tx = {
          room: { create: (...args: unknown[]) => mockRoomCreate(...args) },
          roomMember: { create: (...args: unknown[]) => mockMemberCreate(...args) },
        };
        return arg(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const REPO_INFO = {
  id: "repo-uuid-1",
  githubRepositoryId: "123",
  name: "my-project",
  fullName: "octocat/my-project",
  htmlUrl: "https://github.com/octocat/my-project",
  private: true,
  defaultBranch: "main",
  installationOwnerUserId: "user-42",
  accountLogin: "octocat",
  accountType: "User",
  active: true,
};

describe("Room Service routes", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("POST /rooms without a session returns 401", async () => {
      const res = await request(app).post("/rooms").send({});
      expect(res.status).toBe(401);
    });

    it("POST /rooms/join without a session returns 401", async () => {
      const res = await request(app).post("/rooms/join").send({});
      expect(res.status).toBe(401);
    });

    it("GET /rooms/:roomId without a session returns 401", async () => {
      const res = await request(app).get("/rooms/b2eb6a63-e99c-4b66-b49a-217a7c3e127f");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /rooms (create)", () => {
    it("creates a room, generates a 6-digit code, hashes the password, and makes the creator OWNER", async () => {
      mockGetRepositoryById.mockResolvedValue(REPO_INFO);
      mockRoomFindUnique.mockResolvedValue(null); // room code uniqueness check
      mockRoomCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: "room-uuid-1",
        name: args.data.name,
        roomCode: args.data.roomCode,
        passwordHash: args.data.passwordHash,
        ownerUserId: args.data.ownerUserId,
        githubRepositoryId: args.data.githubRepositoryId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      mockMemberCreate.mockResolvedValue({});

      const token = signToken("user-42");
      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "repo-uuid-1", password: "hunter22" });

      expect(res.status).toBe(201);
      expect(res.body.room.roomCode).toMatch(/^\d{6}$/);
      expect(res.body.room.role).toBe("OWNER");
      expect(res.body.room).not.toHaveProperty("passwordHash");

      const createCall = mockRoomCreate.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe("hunter22");
      expect(await bcrypt.compare("hunter22", createCall.data.passwordHash)).toBe(true);

      const memberCreateCall = mockMemberCreate.mock.calls[0][0];
      expect(memberCreateCall.data.role).toBe("OWNER");
      expect(memberCreateCall.data.userId).toBe("user-42");
    });

    it("returns 404 when the repository does not exist", async () => {
      mockGetRepositoryById.mockResolvedValue(null);
      const token = signToken("user-42");

      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "missing-repo", password: "hunter22" });

      expect(res.status).toBe(404);
      expect(mockRoomCreate).not.toHaveBeenCalled();
    });

    it("returns 403 when the repository belongs to another user's installation", async () => {
      mockGetRepositoryById.mockResolvedValue({ ...REPO_INFO, installationOwnerUserId: "someone-else" });
      const token = signToken("user-42");

      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "repo-uuid-1", password: "hunter22" });

      expect(res.status).toBe(403);
      expect(mockRoomCreate).not.toHaveBeenCalled();
    });

    it("returns 403 when the installation is inactive", async () => {
      mockGetRepositoryById.mockResolvedValue({ ...REPO_INFO, active: false });
      const token = signToken("user-42");

      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "repo-uuid-1", password: "hunter22" });

      expect(res.status).toBe(403);
    });

    it("returns 409 when the repository already backs another room", async () => {
      mockGetRepositoryById.mockResolvedValue(REPO_INFO);
      mockRoomFindUnique.mockResolvedValue(null);
      const { Prisma } = require("@prisma/client");
      mockRoomCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["githubRepositoryId"] },
        }),
      );

      const token = signToken("user-42");
      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "repo-uuid-1", password: "hunter22" });

      expect(res.status).toBe(409);
    });

    it("returns 400 for invalid input (missing fields)", async () => {
      const token = signToken("user-42");
      const res = await request(app).post("/rooms").set("Cookie", [`token=${token}`]).send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for a password below the minimum length", async () => {
      const token = signToken("user-42");
      const res = await request(app)
        .post("/rooms")
        .set("Cookie", [`token=${token}`])
        .send({ name: "My Project", githubRepositoryId: "repo-uuid-1", password: "abc" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /rooms/join", () => {
    it("joins successfully with a valid room code and password", async () => {
      const passwordHash = await bcrypt.hash("hunter22", 10);
      mockRoomFindUnique.mockResolvedValue({
        id: "room-uuid-1",
        name: "My Project",
        roomCode: "123456",
        passwordHash,
      });
      mockMemberFindUnique.mockResolvedValue(null);
      mockMemberCreate.mockResolvedValue({});

      const token = signToken("user-99");
      const res = await request(app)
        .post("/rooms/join")
        .set("Cookie", [`token=${token}`])
        .send({ roomCode: "123456", password: "hunter22" });

      expect(res.status).toBe(200);
      expect(res.body.room.role).toBe("MEMBER");
      expect(mockMemberCreate).toHaveBeenCalledWith({
        data: { roomId: "room-uuid-1", userId: "user-99", role: "MEMBER" },
      });
    });

    it("returns 400 for the wrong password", async () => {
      const passwordHash = await bcrypt.hash("hunter22", 10);
      mockRoomFindUnique.mockResolvedValue({ id: "room-uuid-1", name: "My Project", roomCode: "123456", passwordHash });

      const token = signToken("user-99");
      const res = await request(app)
        .post("/rooms/join")
        .set("Cookie", [`token=${token}`])
        .send({ roomCode: "123456", password: "wrong-password" });

      expect(res.status).toBe(400);
      expect(mockMemberCreate).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-existent room code (same shape as wrong password)", async () => {
      mockRoomFindUnique.mockResolvedValue(null);
      const token = signToken("user-99");

      const res = await request(app)
        .post("/rooms/join")
        .set("Cookie", [`token=${token}`])
        .send({ roomCode: "999999", password: "hunter22" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid room code or password.");
    });

    it("returns 400 for a malformed room code", async () => {
      const token = signToken("user-99");
      const res = await request(app)
        .post("/rooms/join")
        .set("Cookie", [`token=${token}`])
        .send({ roomCode: "12ab", password: "hunter22" });

      expect(res.status).toBe(400);
    });

    it("is idempotent when the user is already a member", async () => {
      const passwordHash = await bcrypt.hash("hunter22", 10);
      mockRoomFindUnique.mockResolvedValue({ id: "room-uuid-1", name: "My Project", roomCode: "123456", passwordHash });
      mockMemberFindUnique.mockResolvedValue({
        id: "member-uuid-1",
        roomId: "room-uuid-1",
        userId: "user-99",
        role: "MEMBER",
      });

      const token = signToken("user-99");
      const res = await request(app)
        .post("/rooms/join")
        .set("Cookie", [`token=${token}`])
        .send({ roomCode: "123456", password: "hunter22" });

      expect(res.status).toBe(200);
      expect(mockMemberCreate).not.toHaveBeenCalled();
    });
  });

  describe("GET /rooms (list mine)", () => {
    it("returns rooms the user is a member of", async () => {
      mockMemberFindMany.mockResolvedValue([
        {
          role: "OWNER",
          room: {
            id: "room-uuid-1",
            name: "My Project",
            roomCode: "123456",
            createdAt: new Date(),
            githubRepository: { name: "my-project", fullName: "octocat/my-project", htmlUrl: "https://github.com/octocat/my-project" },
          },
        },
      ]);

      const token = signToken("user-42");
      const res = await request(app).get("/rooms").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(1);
      expect(res.body.rooms[0].roomCode).toBe("123456");
    });
  });

  describe("GET /rooms/:roomId (details)", () => {
    const roomId = "b2eb6a63-e99c-4b66-b49a-217a7c3e127f";

    it("returns room details for a member", async () => {
      mockMemberFindUnique.mockResolvedValue({ roomId, userId: "user-42", role: "OWNER" });
      mockRoomFindUnique.mockResolvedValue({
        id: roomId,
        name: "My Project",
        roomCode: "123456",
        createdAt: new Date(),
        githubRepository: {
          name: "my-project",
          fullName: "octocat/my-project",
          htmlUrl: "https://github.com/octocat/my-project",
          private: true,
          defaultBranch: "main",
        },
        members: [{ userId: "user-42", role: "OWNER", joinedAt: new Date() }],
      });
      mockGetPublicProfile.mockResolvedValue({
        id: "user-42",
        username: "octocat",
        displayName: "Octo Cat",
        avatarUrl: null,
      });

      const token = signToken("user-42");
      const res = await request(app).get(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.room.currentUserRole).toBe("OWNER");
      expect(res.body.room.members).toHaveLength(1);
      expect(res.body.room.members[0].username).toBe("octocat");
    });

    it("returns 404 for a non-member", async () => {
      mockMemberFindUnique.mockResolvedValue(null);
      const token = signToken("user-99");

      const res = await request(app).get(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed room id", async () => {
      const token = signToken("user-42");
      const res = await request(app).get("/rooms/not-a-uuid").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(400);
    });

    it("never includes passwordHash in the response", async () => {
      mockMemberFindUnique.mockResolvedValue({ roomId, userId: "user-42", role: "OWNER" });
      mockRoomFindUnique.mockResolvedValue({
        id: roomId,
        name: "My Project",
        roomCode: "123456",
        passwordHash: "should-never-appear",
        createdAt: new Date(),
        githubRepository: {
          name: "my-project",
          fullName: "octocat/my-project",
          htmlUrl: "https://github.com/octocat/my-project",
          private: true,
          defaultBranch: "main",
        },
        members: [],
      });

      const token = signToken("user-42");
      const res = await request(app).get(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(JSON.stringify(res.body)).not.toContain("should-never-appear");
    });
  });

  describe("POST /rooms/:roomId/leave", () => {
    const roomId = "b2eb6a63-e99c-4b66-b49a-217a7c3e127f";

    it("allows a MEMBER to leave", async () => {
      mockMemberFindUnique.mockResolvedValue({ roomId, userId: "user-99", role: "MEMBER" });
      mockMemberDelete.mockResolvedValue({});

      const token = signToken("user-99");
      const res = await request(app).post(`/rooms/${roomId}/leave`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(mockMemberDelete).toHaveBeenCalled();
    });

    it("blocks the OWNER from leaving", async () => {
      mockMemberFindUnique.mockResolvedValue({ roomId, userId: "user-42", role: "OWNER" });

      const token = signToken("user-42");
      const res = await request(app).post(`/rooms/${roomId}/leave`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Room owner cannot leave the room.");
      expect(mockMemberDelete).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /rooms/:roomId", () => {
    const roomId = "b2eb6a63-e99c-4b66-b49a-217a7c3e127f";

    it("allows the OWNER to delete the room", async () => {
      mockRoomFindUnique.mockResolvedValue({ id: roomId, ownerUserId: "user-42" });

      const token = signToken("user-42");
      const res = await request(app).delete(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
    });

    it("blocks a non-owner MEMBER from deleting the room", async () => {
      mockRoomFindUnique.mockResolvedValue({ id: roomId, ownerUserId: "user-42" });

      const token = signToken("user-99");
      const res = await request(app).delete(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(403);
    });

    it("returns 404 for a non-existent room", async () => {
      mockRoomFindUnique.mockResolvedValue(null);

      const token = signToken("user-42");
      const res = await request(app).delete(`/rooms/${roomId}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(404);
    });
  });
});
