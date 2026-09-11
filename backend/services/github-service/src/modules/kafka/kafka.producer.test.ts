import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormalizedGitHubEvent } from "../github-events/normalizedEvent";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.KAFKA_BROKERS ??= "localhost:9092";

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockConnectProducer = vi.fn().mockResolvedValue({ send: mockSend });

vi.mock("./kafka.client", () => ({
  connectProducer: () => mockConnectProducer(),
}));

import { publishGithubEvent, KafkaPublishError } from "./kafka.producer";
import { kafkaConfig } from "./kafka.config";

function pushEvent(overrides: Partial<NormalizedGitHubEvent> = {}): NormalizedGitHubEvent {
  return {
    id: "event-uuid-1",
    source: "github",
    type: "github.push",
    deliveryId: "delivery-1",
    repository: { githubRepositoryId: "123456", fullName: "octocat/hello-world" },
    actor: { githubUsername: "octocat" },
    data: { branch: "main", commitCount: 3, afterSha: "abc123" },
    occurredAt: "2026-09-11T10:00:00.000Z",
    ...overrides,
  } as NormalizedGitHubEvent;
}

describe("publishGithubEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
    mockConnectProducer.mockResolvedValue({ send: mockSend });
  });

  it("publishes to the configured github.events topic", async () => {
    await publishGithubEvent(pushEvent(), "room-uuid-1", "octocat pushed 3 commits to main", { githubRepositoryId: "123456", githubUsername: "octocat" });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.topic).toBe(kafkaConfig.githubEventsTopic);
    expect(call.topic).toBe("github.events");
  });

  it("keys the message by roomId, not eventId or repositoryId", async () => {
    await publishGithubEvent(pushEvent(), "room-uuid-42", "content", {});

    const call = mockSend.mock.calls[0][0];
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].key).toBe("room-uuid-42");
  });

  it("publishes a correctly-shaped envelope (eventId, eventType, source, occurredAt, version, data)", async () => {
    const event = pushEvent();
    await publishGithubEvent(event, "room-uuid-1", "octocat pushed 3 commits to main", {
      githubRepositoryId: "123456",
      githubUsername: "octocat",
      branch: "main",
    });

    const call = mockSend.mock.calls[0][0];
    const envelope = JSON.parse(call.messages[0].value);

    expect(envelope).toEqual({
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
        roomId: "room-uuid-1",
        content: "octocat pushed 3 commits to main",
        metadata: { githubRepositoryId: "123456", githubUsername: "octocat", branch: "main" },
      },
    });
  });

  it("serializes the message value as a JSON string, not an object", async () => {
    await publishGithubEvent(pushEvent(), "room-uuid-1", "content", {});

    const call = mockSend.mock.calls[0][0];
    expect(typeof call.messages[0].value).toBe("string");
    expect(() => JSON.parse(call.messages[0].value)).not.toThrow();
  });

  it("reuses the normalized event's own id as the envelope eventId (never a fresh random id)", async () => {
    const event = pushEvent({ id: "same-id-across-retries" });
    await publishGithubEvent(event, "room-uuid-1", "content", {});

    const envelope = JSON.parse(mockSend.mock.calls[0][0].messages[0].value);
    expect(envelope.eventId).toBe("same-id-across-retries");
  });

  it("throws KafkaPublishError when the producer connection fails", async () => {
    mockConnectProducer.mockRejectedValue(new Error("Kafka is not configured (KAFKA_BROKERS is unset)"));

    await expect(publishGithubEvent(pushEvent(), "room-uuid-1", "content", {})).rejects.toThrow(KafkaPublishError);
  });

  it("throws KafkaPublishError when producer.send fails (e.g. broker unreachable after internal retries)", async () => {
    mockSend.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(publishGithubEvent(pushEvent(), "room-uuid-1", "content", {})).rejects.toThrow(KafkaPublishError);
  });

  it("never resolves successfully when the broker never accepted the message", async () => {
    mockSend.mockRejectedValue(new Error("connect ECONNREFUSED"));

    let threw = false;
    try {
      await publishGithubEvent(pushEvent(), "room-uuid-1", "content", {});
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("supports every existing normalized event type without throwing", async () => {
    const events: NormalizedGitHubEvent[] = [
      pushEvent({ type: "github.push" }),
      pushEvent({
        type: "github.pull_request.opened",
        data: { number: 1, title: "t", url: "https://github.com/o/r/pull/1", branch: "b" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.pull_request.closed",
        data: { number: 1, title: "t", url: "https://github.com/o/r/pull/1", branch: "b" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.pull_request.reopened",
        data: { number: 1, title: "t", url: "https://github.com/o/r/pull/1", branch: "b" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.pull_request.merged",
        data: { number: 1, title: "t", url: "https://github.com/o/r/pull/1", branch: "b", baseBranch: "main" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.issue.opened",
        data: { number: 1, title: "t", url: "https://github.com/o/r/issues/1" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.issue.closed",
        data: { number: 1, title: "t", url: "https://github.com/o/r/issues/1" },
      } as Partial<NormalizedGitHubEvent>),
      pushEvent({
        type: "github.issue.reopened",
        data: { number: 1, title: "t", url: "https://github.com/o/r/issues/1" },
      } as Partial<NormalizedGitHubEvent>),
    ];

    for (const event of events) {
      await expect(publishGithubEvent(event, "room-uuid-1", "content", {})).resolves.toBeUndefined();
    }
    expect(mockSend).toHaveBeenCalledTimes(events.length);
  });
});
