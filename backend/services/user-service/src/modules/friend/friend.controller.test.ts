import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";

const mockSearchUsersByUsername = vi.fn();
const mockSendFriendRequest = vi.fn();
const mockRespondToFriendRequest = vi.fn();
const mockListIncomingFriendRequests = vi.fn();
const mockListOutgoingFriendRequests = vi.fn();
const mockListFriends = vi.fn();
const mockRemoveFriend = vi.fn();

vi.mock("./friend.service", async () => {
  const actual = await vi.importActual<typeof import("./friend.service.js")>("./friend.service.js");
  return {
    ...actual,
    searchUsersByUsername: (...args: unknown[]) => mockSearchUsersByUsername(...args),
    sendFriendRequest: (...args: unknown[]) => mockSendFriendRequest(...args),
    respondToFriendRequest: (...args: unknown[]) => mockRespondToFriendRequest(...args),
    listIncomingFriendRequests: (...args: unknown[]) => mockListIncomingFriendRequests(...args),
    listOutgoingFriendRequests: (...args: unknown[]) => mockListOutgoingFriendRequests(...args),
    listFriends: (...args: unknown[]) => mockListFriends(...args),
    removeFriend: (...args: unknown[]) => mockRemoveFriend(...args),
  };
});

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("friend routes", () => {
  let app: ReturnType<typeof express>;
  let token: string;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
    token = signToken(USER_ID);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /users/search", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/users/search").query({ username: "yash" });
      expect(res.status).toBe(401);
    });

    it("returns 400 for a missing username query param", async () => {
      const res = await request(app).get("/users/search").set("Cookie", [`token=${token}`]);
      expect(res.status).toBe(400);
    });

    it("returns matching users for a valid query", async () => {
      mockSearchUsersByUsername.mockResolvedValue([
        { id: OTHER_USER_ID, username: "yashvi", displayName: "Yashvi", avatarUrl: null },
      ]);

      const res = await request(app)
        .get("/users/search")
        .query({ username: "yash" })
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(mockSearchUsersByUsername).toHaveBeenCalledWith(USER_ID, "yash");
    });
  });

  describe("POST /users/friend-requests", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).post("/users/friend-requests").send({ username: "yashvi" });
      expect(res.status).toBe(401);
    });

    it("returns 400 for a missing username", async () => {
      const res = await request(app)
        .post("/users/friend-requests")
        .set("Cookie", [`token=${token}`])
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 when the target user doesn't exist", async () => {
      mockSendFriendRequest.mockRejectedValue(Object.assign(new Error("User not found."), { status: 404 }));
      const FriendServiceError = (await import("./friend.service.js")).FriendServiceError;
      mockSendFriendRequest.mockRejectedValue(new FriendServiceError("User not found.", 404));

      const res = await request(app)
        .post("/users/friend-requests")
        .set("Cookie", [`token=${token}`])
        .send({ username: "ghost" });

      expect(res.status).toBe(404);
    });

    it("creates a friend request on success", async () => {
      mockSendFriendRequest.mockResolvedValue({
        id: REQUEST_ID,
        senderId: USER_ID,
        receiverId: OTHER_USER_ID,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        otherUser: { id: OTHER_USER_ID, username: "yashvi", displayName: null, avatarUrl: null },
      });

      const res = await request(app)
        .post("/users/friend-requests")
        .set("Cookie", [`token=${token}`])
        .send({ username: "yashvi" });

      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe("PENDING");
      expect(mockSendFriendRequest).toHaveBeenCalledWith(USER_ID, "yashvi");
    });
  });

  describe("PATCH /users/friend-requests/:requestId", () => {
    it("returns 400 for an invalid action", async () => {
      const res = await request(app)
        .patch(`/users/friend-requests/${REQUEST_ID}`)
        .set("Cookie", [`token=${token}`])
        .send({ action: "maybe" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for a malformed request id", async () => {
      const res = await request(app)
        .patch("/users/friend-requests/not-a-uuid")
        .set("Cookie", [`token=${token}`])
        .send({ action: "accept" });
      expect(res.status).toBe(400);
    });

    it("returns 403 when the responder isn't the receiver", async () => {
      const FriendServiceError = (await import("./friend.service.js")).FriendServiceError;
      mockRespondToFriendRequest.mockRejectedValue(
        new FriendServiceError("You do not have access to this friend request.", 403),
      );

      const res = await request(app)
        .patch(`/users/friend-requests/${REQUEST_ID}`)
        .set("Cookie", [`token=${token}`])
        .send({ action: "accept" });

      expect(res.status).toBe(403);
    });

    it("accepts a request on success", async () => {
      mockRespondToFriendRequest.mockResolvedValue({
        id: REQUEST_ID,
        senderId: OTHER_USER_ID,
        receiverId: USER_ID,
        status: "ACCEPTED",
        createdAt: new Date().toISOString(),
        otherUser: { id: OTHER_USER_ID, username: "yashvi", displayName: null, avatarUrl: null },
      });

      const res = await request(app)
        .patch(`/users/friend-requests/${REQUEST_ID}`)
        .set("Cookie", [`token=${token}`])
        .send({ action: "accept" });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe("ACCEPTED");
    });
  });

  describe("GET /users/friend-requests", () => {
    it("returns incoming and outgoing lists", async () => {
      mockListIncomingFriendRequests.mockResolvedValue([]);
      mockListOutgoingFriendRequests.mockResolvedValue([]);

      const res = await request(app).get("/users/friend-requests").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ incoming: [], outgoing: [] });
    });
  });

  describe("GET /users/friends", () => {
    it("returns the friends list", async () => {
      mockListFriends.mockResolvedValue([
        { id: OTHER_USER_ID, username: "yashvi", displayName: null, avatarUrl: null, friendsSince: new Date().toISOString() },
      ]);

      const res = await request(app).get("/users/friends").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.friends).toHaveLength(1);
    });
  });

  describe("DELETE /users/friends/:userId", () => {
    it("returns 404 when not friends", async () => {
      const FriendServiceError = (await import("./friend.service.js")).FriendServiceError;
      mockRemoveFriend.mockRejectedValue(new FriendServiceError("You are not friends with this user.", 404));

      const res = await request(app)
        .delete(`/users/friends/${OTHER_USER_ID}`)
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(404);
    });

    it("returns 204 on success", async () => {
      mockRemoveFriend.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/users/friends/${OTHER_USER_ID}`)
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(204);
    });
  });
});
