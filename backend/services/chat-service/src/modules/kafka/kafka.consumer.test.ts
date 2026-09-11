import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.KAFKA_BROKERS ??= "localhost:9092";

const mockPublishToDlq = vi.fn().mockResolvedValue(undefined);
vi.mock("./kafka.dlq", () => ({
  publishToDlq: (...args: unknown[]) => mockPublishToDlq(...args),
}));

const mockBroadcastMessageEvent = vi.fn();
vi.mock("../ws/wsServer", () => ({
  broadcastMessageEvent: (...args: unknown[]) => mockBroadcastMessageEvent(...args),
}));

const mockGetDefaultChannel = vi.fn();
vi.mock("../room/roomServiceClient", () => ({
  getDefaultChannel: (...args: unknown[]) => mockGetDefaultChannel(...args),
  RoomServiceClientError: class RoomServiceClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockMessageCreate = vi.fn();
const mockMessageFindUniqueOrThrow = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    message: {
      create: (...args: unknown[]) => mockMessageCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockMessageFindUniqueOrThrow(...args),
    },
  },
}));

import { handleGithubEventMessage } from "./kafka.consumer";
import { RoomServiceClientError } from "../room/roomServiceClient"; // resolves to MockRoomServiceClientError via the vi.mock above

const ROOM_ID = "b2eb6a63-e99c-4b66-b49a-217a7c3e127f";
const CHANNEL_ID = "c2eb6a63-e99c-4b66-b49a-217a7c3e127f";

function validEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    eventId: "event-uuid-1",
    eventType: "github.push",
    source: "github-service",
    occurredAt: "2026-09-11T10:00:00.000Z",
    version: 1,
    data: {
      id: "event-uuid-1",
      source: "github",
      type: "github.push",
      deliveryId: "delivery-1",
      repository: { githubRepositoryId: "123456", fullName: "octocat/hello-world" },
      actor: { githubUsername: "octocat" },
      data: { branch: "main", commitCount: 3, afterSha: "abc123" },
      occurredAt: "2026-09-11T10:00:00.000Z",
      roomId: ROOM_ID,
      content: "octocat pushed 3 commits to main",
      metadata: { githubRepositoryId: "123456", githubUsername: "octocat", branch: "main" },
      ...overrides,
    },
  });
}

function fakeMessageRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "msg-uuid-1",
    roomId: ROOM_ID,
    channelId: CHANNEL_ID,
    userId: null,
    senderType: "SYSTEM",
    systemEventType: "github.push",
    metadata: { githubRepositoryId: "123456", githubUsername: "octocat" },
    content: "octocat pushed 3 commits to main",
    sourceEventId: "event-uuid-1",
    parentMessageId: null,
    replyCount: 0,
    mentionedUserIds: [],
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("handleGithubEventMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultChannel.mockResolvedValue({ id: CHANNEL_ID, name: "general", isDefault: true });
  });

  it("creates a system message and broadcasts it for a valid event", async () => {
    mockMessageCreate.mockResolvedValue(fakeMessageRow());

    await handleGithubEventMessage(validEnvelope());

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: ROOM_ID,
        channelId: CHANNEL_ID,
        senderType: "SYSTEM",
        systemEventType: "github.push",
        content: "octocat pushed 3 commits to main",
        sourceEventId: "event-uuid-1",
      }),
    });
    expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);
    expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(ROOM_ID, "message.created", expect.objectContaining({ id: "msg-uuid-1" }));
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  });

  it("supports every existing normalized event type", async () => {
    mockMessageCreate.mockResolvedValue(fakeMessageRow());
    const types = [
      { type: "github.push", eventType: "github.push" },
      { type: "github.pull_request.opened", eventType: "github.pull_request.opened" },
      { type: "github.pull_request.closed", eventType: "github.pull_request.closed" },
      { type: "github.pull_request.reopened", eventType: "github.pull_request.reopened" },
      { type: "github.pull_request.merged", eventType: "github.pull_request.merged" },
      { type: "github.issue.opened", eventType: "github.issue.opened" },
      { type: "github.issue.closed", eventType: "github.issue.closed" },
      { type: "github.issue.reopened", eventType: "github.issue.reopened" },
    ];

    for (const { type } of types) {
      mockMessageCreate.mockClear();
      const envelope = JSON.parse(validEnvelope());
      envelope.eventType = type;
      envelope.data.type = type;
      await handleGithubEventMessage(JSON.stringify(envelope));
      expect(mockMessageCreate).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a malformed event (invalid JSON) without crashing, routes it to the DLQ", async () => {
    await expect(handleGithubEventMessage("{ not valid json")).resolves.toBeUndefined();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledTimes(1);
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({ errorClassification: "invalid_event", eventId: null }),
    );
  });

  it("rejects a structurally invalid envelope (missing required fields) without crashing, routes it to the DLQ", async () => {
    await expect(handleGithubEventMessage(JSON.stringify({ eventType: "github.push" }))).resolves.toBeUndefined();

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({ errorClassification: "invalid_event" }),
    );
  });

  it("rejects an envelope with an unsupported version, routes it to the DLQ", async () => {
    const envelope = JSON.parse(validEnvelope());
    envelope.version = 2;

    await handleGithubEventMessage(JSON.stringify(envelope));

    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({ errorClassification: "invalid_event" }),
    );
  });

  it("a null message value (tombstone) is a safe no-op", async () => {
    await expect(handleGithubEventMessage(null)).resolves.toBeUndefined();
    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  });

  it("does not create a duplicate message for a duplicate eventId (P2002 on sourceEventId)", async () => {
    const { Prisma } = await import("@prisma/client");
    mockMessageCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["sourceEventId"] },
      }),
    );
    mockMessageFindUniqueOrThrow.mockResolvedValue(fakeMessageRow());

    await handleGithubEventMessage(validEnvelope());

    expect(mockMessageFindUniqueOrThrow).toHaveBeenCalledWith({ where: { sourceEventId: "event-uuid-1" } });
    // The duplicate path must never re-broadcast — the original create
    // already broadcast it once.
    expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  });

  it("processing the exact same message twice in a row never creates two messages", async () => {
    mockMessageCreate.mockResolvedValueOnce(fakeMessageRow());

    await handleGithubEventMessage(validEnvelope());
    expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);

    const { Prisma } = await import("@prisma/client");
    mockMessageCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["sourceEventId"] },
      }),
    );
    mockMessageFindUniqueOrThrow.mockResolvedValue(fakeMessageRow());

    await handleGithubEventMessage(validEnvelope());
    // Still only ever broadcast once across both deliveries of the same event.
    expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure (Room Service unreachable) and succeeds without reaching the DLQ", async () => {
    mockGetDefaultChannel
      .mockRejectedValueOnce(new RoomServiceClientError("Room Service unavailable", 502))
      .mockResolvedValueOnce({ id: CHANNEL_ID, name: "general", isDefault: true });
    mockMessageCreate.mockResolvedValue(fakeMessageRow());

    await handleGithubEventMessage(validEnvelope());

    expect(mockGetDefaultChannel).toHaveBeenCalledTimes(2);
    expect(mockMessageCreate).toHaveBeenCalledTimes(1);
    expect(mockBroadcastMessageEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  }, 10000);

  it("a transient failure that never recovers exhausts its retries and reaches the DLQ", async () => {
    mockGetDefaultChannel.mockRejectedValue(new RoomServiceClientError("Room Service unavailable", 502));

    await handleGithubEventMessage(validEnvelope());

    expect(mockGetDefaultChannel.mock.calls.length).toBeGreaterThan(1);
    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "event-uuid-1", errorClassification: "processing_failure" }),
    );
  }, 10000);

  it("a permanent failure (room not found, 404) reaches the DLQ without retrying", async () => {
    mockGetDefaultChannel.mockResolvedValue(null); // -> MessageServiceError("Room not found.", 404)

    await handleGithubEventMessage(validEnvelope());

    // 404 is not transient — isTransient() returns false, so only one attempt is made.
    expect(mockGetDefaultChannel).toHaveBeenCalledTimes(1);
    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "event-uuid-1" }),
    );
  });

  it("always resolves (never throws) even when everything fails, so the consumer offset can still advance", async () => {
    mockGetDefaultChannel.mockRejectedValue(new Error("totally unexpected failure"));

    await expect(handleGithubEventMessage(validEnvelope())).resolves.toBeUndefined();
  }, 10000);
});
