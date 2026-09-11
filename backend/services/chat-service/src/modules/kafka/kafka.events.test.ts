import { describe, it, expect } from "vitest";
import { parseGithubEventMessage, InvalidGithubEventError } from "./kafka.events";

const ROOM_ID = "b2eb6a63-e99c-4b66-b49a-217a7c3e127f";

function envelope(overrides: {
  eventType?: string;
  dataType?: string;
  data?: Record<string, unknown>;
} = {}) {
  const eventType = overrides.eventType ?? "github.push";
  return JSON.stringify({
    eventId: "event-uuid-1",
    eventType,
    source: "github-service",
    occurredAt: "2026-09-11T10:00:00.000Z",
    version: 1,
    data: {
      id: "event-uuid-1",
      source: "github",
      type: overrides.dataType ?? eventType,
      deliveryId: "delivery-1",
      repository: { githubRepositoryId: "123456", fullName: "octocat/hello-world" },
      actor: { githubUsername: "octocat" },
      data: { branch: "main", commitCount: 3, afterSha: "abc123" },
      occurredAt: "2026-09-11T10:00:00.000Z",
      roomId: ROOM_ID,
      content: "octocat pushed 3 commits to main",
      metadata: { githubRepositoryId: "123456", githubUsername: "octocat" },
      ...overrides.data,
    },
  });
}

describe("parseGithubEventMessage", () => {
  it("accepts a valid github.push envelope", () => {
    const result = parseGithubEventMessage(envelope());
    expect(result.eventType).toBe("github.push");
    expect(result.data.roomId).toBe(ROOM_ID);
  });

  const eventTypes = [
    "github.push",
    "github.pull_request.opened",
    "github.pull_request.closed",
    "github.pull_request.reopened",
    "github.pull_request.merged",
    "github.issue.opened",
    "github.issue.closed",
    "github.issue.reopened",
  ];

  it.each(eventTypes)("accepts a valid %s envelope", (eventType) => {
    const result = parseGithubEventMessage(envelope({ eventType }));
    expect(result.eventType).toBe(eventType);
    expect(result.data.type).toBe(eventType);
  });

  it("throws InvalidGithubEventError for invalid JSON", () => {
    expect(() => parseGithubEventMessage("not json")).toThrow(InvalidGithubEventError);
  });

  it("throws InvalidGithubEventError for an unrecognized eventType", () => {
    expect(() => parseGithubEventMessage(envelope({ eventType: "github.star.created", dataType: "github.star.created" }))).toThrow(
      InvalidGithubEventError,
    );
  });

  it("throws InvalidGithubEventError when version is not 1", () => {
    const raw = JSON.parse(envelope());
    raw.version = 2;
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("throws InvalidGithubEventError when source is not github-service", () => {
    const raw = JSON.parse(envelope());
    raw.source = "some-other-service";
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("throws InvalidGithubEventError when roomId is not a UUID", () => {
    const raw = JSON.parse(envelope());
    raw.data.roomId = "not-a-uuid";
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("throws InvalidGithubEventError when content is empty", () => {
    const raw = JSON.parse(envelope());
    raw.data.content = "";
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("throws InvalidGithubEventError when a required top-level field is missing", () => {
    const raw = JSON.parse(envelope());
    delete raw.eventId;
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("rejects a metadata.url that is not an https://github.com/ link", () => {
    const raw = JSON.parse(envelope());
    raw.data.metadata.url = "https://evil.example.com/x";
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).toThrow(InvalidGithubEventError);
  });

  it("accepts extra/unknown metadata keys (forward-compatible, not .strict())", () => {
    const raw = JSON.parse(envelope());
    raw.data.metadata.futureField = "something a newer producer might add";
    expect(() => parseGithubEventMessage(JSON.stringify(raw))).not.toThrow();
  });
});
