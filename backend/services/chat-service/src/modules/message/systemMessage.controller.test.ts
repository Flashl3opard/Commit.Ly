import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";

const mockMessageCreate = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      create: (...args: unknown[]) => mockMessageCreate(...args),
    },
  },
}));

const mockBroadcastMessageEvent = vi.fn();
vi.mock("../ws/wsServer", () => ({
  broadcastMessageEvent: (...args: unknown[]) => mockBroadcastMessageEvent(...args),
}));

const mockGetDefaultChannel = vi.fn();
vi.mock("../room/roomServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../room/roomServiceClient.js")>(
    "../room/roomServiceClient.js",
  );
  return {
    ...actual,
    getDefaultChannel: (...args: unknown[]) => mockGetDefaultChannel(...args),
  };
});

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const CHANNEL_ID = "99999999-9999-4999-8999-999999999999";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    eventType: "github.pull_request.opened",
    content: "alice opened PR #42: Fix multiplayer synchronization",
    metadata: {
      githubRepositoryId: "123456",
      githubUsername: "alice",
      number: 42,
      title: "Fix multiplayer synchronization",
      url: "https://github.com/octocat/hello-world/pull/42",
    },
    ...overrides,
  };
}

describe("POST /internal/rooms/:roomId/system-messages", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockGetDefaultChannel.mockResolvedValue({ id: CHANNEL_ID, name: "general", isDefault: true });
  });

  function send(body: object, secret = "test-internal-secret") {
    let req = request(app).post(`/internal/rooms/${ROOM_ID}/system-messages`);
    if (secret) req = req.set("x-internal-service-secret", secret);
    return req.send(body);
  }

  it("accepts a valid internal system message", async () => {
    const now = new Date();
    mockMessageCreate.mockResolvedValue({
      id: "sys-msg-1",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: null,
      senderType: "SYSTEM",
      systemEventType: "github.pull_request.opened",
      metadata: validBody().metadata,
      content: validBody().content,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });

    const res = await send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({
      id: "sys-msg-1",
      roomId: ROOM_ID,
      userId: null,
      senderType: "system",
      systemEventType: "github.pull_request.opened",
    });
  });

  it("rejects a request missing the internal secret", async () => {
    const res = await request(app).post(`/internal/rooms/${ROOM_ID}/system-messages`).send(validBody());
    expect(res.status).toBe(401);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong internal secret", async () => {
    const res = await send(validBody(), "wrong-secret");
    expect(res.status).toBe(401);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid event type", async () => {
    const res = await send(validBody({ eventType: "github.totally_made_up" }));
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid room id", async () => {
    const res = await request(app)
      .post("/internal/rooms/not-a-uuid/system-messages")
      .set("x-internal-service-secret", "test-internal-secret")
      .send(validBody());
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects missing required metadata fields", async () => {
    const res = await send(validBody({ metadata: { githubUsername: "alice" } }));
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-GitHub URL in metadata", async () => {
    const res = await send(
      validBody({ metadata: { ...validBody().metadata, url: "https://evil.example.com/steal-cookies" } }),
    );
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects a javascript: URL in metadata", async () => {
    const res = await send(validBody({ metadata: { ...validBody().metadata, url: "javascript:alert(1)" } }));
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects content over the max length", async () => {
    const res = await send(validBody({ content: "a".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects blank content", async () => {
    const res = await send(validBody({ content: "   " }));
    expect(res.status).toBe(400);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects unexpected extra fields in the body (strict schema)", async () => {
    const res = await send({ ...validBody(), extraField: "should not be allowed" });
    expect(res.status).toBe(400);
  });

  it("persists the message with senderType SYSTEM and userId null", async () => {
    const now = new Date();
    mockMessageCreate.mockResolvedValue({
      id: "sys-msg-2",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: null,
      senderType: "SYSTEM",
      systemEventType: "github.push",
      metadata: { githubRepositoryId: "1", githubUsername: "bob" },
      content: "bob pushed 2 commits to main",
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });

    await send(validBody({ eventType: "github.push", metadata: { githubRepositoryId: "1", githubUsername: "bob" } }));

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: ROOM_ID,
        userId: null,
        senderType: "SYSTEM",
        systemEventType: "github.push",
      }),
    });
  });

  it("broadcasts message.created after successful persistence", async () => {
    const now = new Date();
    mockMessageCreate.mockResolvedValue({
      id: "sys-msg-3",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: null,
      senderType: "SYSTEM",
      systemEventType: "github.pull_request.opened",
      metadata: validBody().metadata,
      content: validBody().content,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });

    const res = await send(validBody());

    expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.created", res.body.message);
  });

  it("does not broadcast when the database write fails", async () => {
    mockMessageCreate.mockRejectedValue(new Error("database unavailable"));

    const res = await send(validBody());

    expect(res.status).toBe(500);
    expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
  });

  it("never accepts a userId field from the caller (system messages cannot impersonate a user)", async () => {
    const now = new Date();
    mockMessageCreate.mockResolvedValue({
      id: "sys-msg-4",
      roomId: ROOM_ID,
      channelId: CHANNEL_ID,
      userId: null,
      senderType: "SYSTEM",
      systemEventType: "github.pull_request.opened",
      metadata: validBody().metadata,
      content: validBody().content,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      deletedAt: null,
    });

    // Even if a caller tries to sneak a userId into the body, the strict
    // schema rejects the unknown field outright.
    const res = await send({ ...validBody(), userId: "some-real-user-id" });
    expect(res.status).toBe(400);
  });
});
