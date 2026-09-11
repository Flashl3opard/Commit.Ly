import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";

const mockAreUsersFriends = vi.fn();
vi.mock("../user/userServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../user/userServiceClient.js")>(
    "../user/userServiceClient.js",
  );
  return {
    ...actual,
    areUsersFriends: (...args: unknown[]) => mockAreUsersFriends(...args),
  };
});

const mockConversationFindUnique = vi.fn();
const mockConversationFindMany = vi.fn();
const mockConversationUpsert = vi.fn();
const mockConversationUpdate = vi.fn();
const mockDmMessageCreate = vi.fn();
const mockDmMessageFindMany = vi.fn();
const mockDmMessageFindUnique = vi.fn();
const mockDmMessageUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    dmConversation: {
      findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
      findMany: (...args: unknown[]) => mockConversationFindMany(...args),
      upsert: (...args: unknown[]) => mockConversationUpsert(...args),
      update: (...args: unknown[]) => mockConversationUpdate(...args),
    },
    dmMessage: {
      create: (...args: unknown[]) => mockDmMessageCreate(...args),
      findMany: (...args: unknown[]) => mockDmMessageFindMany(...args),
      findUnique: (...args: unknown[]) => mockDmMessageFindUnique(...args),
      update: (...args: unknown[]) => mockDmMessageUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockBroadcastDmMessageEvent = vi.fn();
vi.mock("../ws/wsServer", () => ({
  broadcastDmMessageEvent: (...args: unknown[]) => mockBroadcastDmMessageEvent(...args),
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "99999999-9999-4999-8999-999999999999";
const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

const now = new Date();

describe("DM routes", () => {
  let app: ReturnType<typeof express>;
  let token: string;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
    token = signToken(USER_A_ID);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /dm/conversations", () => {
    it("returns 401 without a session cookie", async () => {
      const res = await request(app).post("/dm/conversations").send({ userId: USER_B_ID });
      expect(res.status).toBe(401);
    });

    it("returns 403 when the two users are not friends", async () => {
      mockAreUsersFriends.mockResolvedValue(false);

      const res = await request(app)
        .post("/dm/conversations")
        .set("Cookie", [`token=${token}`])
        .send({ userId: USER_B_ID });

      expect(res.status).toBe(403);
    });

    it("returns 400 when trying to open a conversation with yourself", async () => {
      const res = await request(app)
        .post("/dm/conversations")
        .set("Cookie", [`token=${token}`])
        .send({ userId: USER_A_ID });

      expect(res.status).toBe(400);
    });

    it("creates/returns the conversation on success", async () => {
      mockAreUsersFriends.mockResolvedValue(true);
      mockConversationUpsert.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });

      const res = await request(app)
        .post("/dm/conversations")
        .set("Cookie", [`token=${token}`])
        .send({ userId: USER_B_ID });

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(CONVERSATION_ID);
    });
  });

  describe("GET /dm/conversations", () => {
    it("returns the user's conversations with last-message previews", async () => {
      mockConversationFindMany.mockResolvedValue([
        {
          id: CONVERSATION_ID,
          userAId: USER_A_ID,
          userBId: USER_B_ID,
          createdAt: now,
          updatedAt: now,
          messages: [
            {
              id: MESSAGE_ID,
              conversationId: CONVERSATION_ID,
              senderId: USER_B_ID,
              content: "hey",
              sequence: 1n,
              createdAt: now,
              updatedAt: now,
              editedAt: null,
              deletedAt: null,
            },
          ],
        },
      ]);

      const res = await request(app).get("/dm/conversations").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].otherUserId).toBe(USER_B_ID);
      expect(res.body.conversations[0].lastMessage.content).toBe("hey");
    });
  });

  describe("POST /dm/conversations/:conversationId/messages", () => {
    it("returns 404 when the conversation doesn't belong to the user", async () => {
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: "44444444-4444-4444-8444-444444444444",
        userBId: "55555555-5555-4555-8555-555555555555",
        createdAt: now,
        updatedAt: now,
      });

      const res = await request(app)
        .post(`/dm/conversations/${CONVERSATION_ID}/messages`)
        .set("Cookie", [`token=${token}`])
        .send({ content: "hi" });

      expect(res.status).toBe(404);
    });

    it("returns 403 when friendship no longer holds", async () => {
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });
      mockAreUsersFriends.mockResolvedValue(false);

      const res = await request(app)
        .post(`/dm/conversations/${CONVERSATION_ID}/messages`)
        .set("Cookie", [`token=${token}`])
        .send({ content: "hi" });

      expect(res.status).toBe(403);
    });

    it("creates the message and broadcasts it on success", async () => {
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });
      mockAreUsersFriends.mockResolvedValue(true);
      mockTransaction.mockResolvedValue([
        {
          id: MESSAGE_ID,
          conversationId: CONVERSATION_ID,
          senderId: USER_A_ID,
          content: "hi",
          sequence: 2n,
          createdAt: now,
          updatedAt: now,
          editedAt: null,
          deletedAt: null,
        },
        {},
      ]);

      const res = await request(app)
        .post(`/dm/conversations/${CONVERSATION_ID}/messages`)
        .set("Cookie", [`token=${token}`])
        .send({ content: "hi" });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toBe("hi");
      expect(mockBroadcastDmMessageEvent).toHaveBeenCalledWith(
        CONVERSATION_ID,
        "dm.message.created",
        expect.objectContaining({ content: "hi" }),
      );
    });
  });

  describe("GET /dm/conversations/:conversationId/messages", () => {
    it("returns message history for a participant", async () => {
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });
      mockDmMessageFindMany.mockResolvedValue([
        {
          id: MESSAGE_ID,
          conversationId: CONVERSATION_ID,
          senderId: USER_B_ID,
          content: "hey",
          sequence: 1n,
          createdAt: now,
          updatedAt: now,
          editedAt: null,
          deletedAt: null,
        },
      ]);

      const res = await request(app)
        .get(`/dm/conversations/${CONVERSATION_ID}/messages`)
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  describe("PATCH /dm/messages/:messageId", () => {
    it("returns 403 when editing someone else's message", async () => {
      mockDmMessageFindUnique.mockResolvedValue({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: USER_B_ID,
        content: "hey",
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: null,
      });
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });

      const res = await request(app)
        .patch(`/dm/messages/${MESSAGE_ID}`)
        .set("Cookie", [`token=${token}`])
        .send({ content: "edited" });

      expect(res.status).toBe(403);
    });

    it("edits the message and broadcasts it on success", async () => {
      mockDmMessageFindUnique.mockResolvedValue({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: USER_A_ID,
        content: "hey",
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: null,
      });
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });
      mockDmMessageUpdate.mockResolvedValue({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: USER_A_ID,
        content: "edited",
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: now,
        deletedAt: null,
      });

      const res = await request(app)
        .patch(`/dm/messages/${MESSAGE_ID}`)
        .set("Cookie", [`token=${token}`])
        .send({ content: "edited" });

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe("edited");
      expect(mockBroadcastDmMessageEvent).toHaveBeenCalledWith(
        CONVERSATION_ID,
        "dm.message.updated",
        expect.objectContaining({ content: "edited" }),
      );
    });
  });

  describe("DELETE /dm/messages/:messageId", () => {
    it("soft-deletes the message and broadcasts a tombstone", async () => {
      mockDmMessageFindUnique.mockResolvedValue({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: USER_A_ID,
        content: "hey",
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: null,
      });
      mockConversationFindUnique.mockResolvedValue({
        id: CONVERSATION_ID,
        userAId: USER_A_ID,
        userBId: USER_B_ID,
        createdAt: now,
        updatedAt: now,
      });
      mockDmMessageUpdate.mockResolvedValue({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: USER_A_ID,
        content: "hey",
        sequence: 1n,
        createdAt: now,
        updatedAt: now,
        editedAt: null,
        deletedAt: now,
      });

      const res = await request(app).delete(`/dm/messages/${MESSAGE_ID}`).set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBeNull();
      expect(mockBroadcastDmMessageEvent).toHaveBeenCalledWith(
        CONVERSATION_ID,
        "dm.message.deleted",
        expect.objectContaining({ content: null }),
      );
    });
  });
});
