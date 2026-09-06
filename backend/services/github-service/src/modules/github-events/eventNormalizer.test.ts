import { describe, it, expect } from "vitest";
import { normalizeGitHubEvent } from "./eventNormalizer";
import type { ParsedIssuesEvent, ParsedPullRequestEvent, ParsedPushEvent } from "../github-webhook/webhookEvent.schemas";

const DELIVERY_ID = "delivery-abc-123";

function pushEvent(overrides: Partial<ParsedPushEvent> = {}): ParsedPushEvent {
  return {
    kind: "push",
    repositoryId: 123456,
    repositoryFullName: "octocat/hello-world",
    actor: "octocat",
    ref: "refs/heads/main",
    after: "deadbeef",
    commitCount: 3,
    ...overrides,
  };
}

function pullRequestEvent(overrides: Partial<ParsedPullRequestEvent> = {}): ParsedPullRequestEvent {
  return {
    kind: "pull_request",
    repositoryId: 555,
    repositoryFullName: "octocat/hello-world",
    actor: "alice",
    action: "opened",
    prNumber: 42,
    prTitle: "Fix multiplayer synchronization",
    prUrl: "https://github.com/octocat/hello-world/pull/42",
    merged: false,
    headBranch: "feature/sync-fix",
    baseBranch: "main",
    ...overrides,
  };
}

function issuesEvent(overrides: Partial<ParsedIssuesEvent> = {}): ParsedIssuesEvent {
  return {
    kind: "issues",
    repositoryId: 777,
    repositoryFullName: "octocat/hello-world",
    actor: "bob",
    action: "opened",
    issueNumber: 18,
    issueTitle: "Leaderboard not updating",
    issueUrl: "https://github.com/octocat/hello-world/issues/18",
    ...overrides,
  };
}

describe("normalizeGitHubEvent — push", () => {
  it("normalizes a push event correctly", () => {
    const result = normalizeGitHubEvent(pushEvent(), DELIVERY_ID);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("github.push");
    expect(result?.data).toEqual({ branch: "main", commitCount: 3, afterSha: "deadbeef" });
  });

  it("extracts the short branch name from refs/heads/*", () => {
    const result = normalizeGitHubEvent(pushEvent({ ref: "refs/heads/feature/cool-thing" }), DELIVERY_ID);
    expect(result?.type === "github.push" && result.data.branch).toBe("feature/cool-thing");
  });

  it("safely ignores a non-branch ref (e.g. a tag push)", () => {
    const result = normalizeGitHubEvent(pushEvent({ ref: "refs/tags/v1.0.0" }), DELIVERY_ID);
    expect(result).toBeNull();
  });

  it("uses the commit count from the payload, not a fabricated value", () => {
    const result = normalizeGitHubEvent(pushEvent({ commitCount: 0 }), DELIVERY_ID);
    expect(result?.type === "github.push" && result.data.commitCount).toBe(0);
  });
});

describe("normalizeGitHubEvent — pull_request", () => {
  it("normalizes PR opened", () => {
    const result = normalizeGitHubEvent(pullRequestEvent({ action: "opened" }), DELIVERY_ID);
    expect(result?.type).toBe("github.pull_request.opened");
  });

  it("normalizes PR reopened", () => {
    const result = normalizeGitHubEvent(pullRequestEvent({ action: "reopened" }), DELIVERY_ID);
    expect(result?.type).toBe("github.pull_request.reopened");
  });

  it("normalizes PR closed (not merged) as github.pull_request.closed", () => {
    const result = normalizeGitHubEvent(pullRequestEvent({ action: "closed", merged: false }), DELIVERY_ID);
    expect(result?.type).toBe("github.pull_request.closed");
  });

  it("normalizes PR closed + merged=true as github.pull_request.merged", () => {
    const result = normalizeGitHubEvent(pullRequestEvent({ action: "closed", merged: true }), DELIVERY_ID);
    expect(result?.type).toBe("github.pull_request.merged");
  });

  it("merged=true only ever produces github.pull_request.merged, never closed", () => {
    const merged = normalizeGitHubEvent(pullRequestEvent({ action: "closed", merged: true }), DELIVERY_ID);
    expect(merged?.type).not.toBe("github.pull_request.closed");
  });

  it("closed + merged=false never produces github.pull_request.merged", () => {
    const closed = normalizeGitHubEvent(pullRequestEvent({ action: "closed", merged: false }), DELIVERY_ID);
    expect(closed?.type).not.toBe("github.pull_request.merged");
  });

  it("includes baseBranch only for merged PRs when GitHub provided it", () => {
    const merged = normalizeGitHubEvent(
      pullRequestEvent({ action: "closed", merged: true, baseBranch: "main" }),
      DELIVERY_ID,
    );
    expect(merged?.type === "github.pull_request.merged" && merged.data.baseBranch).toBe("main");

    const opened = normalizeGitHubEvent(pullRequestEvent({ action: "opened", baseBranch: "main" }), DELIVERY_ID);
    expect(opened?.type === "github.pull_request.opened" && opened.data.baseBranch).toBeUndefined();
  });

  it("does not fabricate baseBranch when GitHub did not provide it", () => {
    const merged = normalizeGitHubEvent(
      pullRequestEvent({ action: "closed", merged: true, baseBranch: null }),
      DELIVERY_ID,
    );
    expect(merged?.type === "github.pull_request.merged" && merged.data.baseBranch).toBeUndefined();
  });

  it("safely ignores an unknown pull_request action", () => {
    const result = normalizeGitHubEvent(pullRequestEvent({ action: "labeled" }), DELIVERY_ID);
    expect(result).toBeNull();
  });

  it("preserves PR number, title, url, and branch in data", () => {
    const result = normalizeGitHubEvent(pullRequestEvent(), DELIVERY_ID);
    expect(result?.type === "github.pull_request.opened" && result.data).toEqual({
      number: 42,
      title: "Fix multiplayer synchronization",
      url: "https://github.com/octocat/hello-world/pull/42",
      branch: "feature/sync-fix",
    });
  });
});

describe("normalizeGitHubEvent — issues", () => {
  it("normalizes issue opened", () => {
    const result = normalizeGitHubEvent(issuesEvent({ action: "opened" }), DELIVERY_ID);
    expect(result?.type).toBe("github.issue.opened");
  });

  it("normalizes issue closed", () => {
    const result = normalizeGitHubEvent(issuesEvent({ action: "closed" }), DELIVERY_ID);
    expect(result?.type).toBe("github.issue.closed");
  });

  it("normalizes issue reopened", () => {
    const result = normalizeGitHubEvent(issuesEvent({ action: "reopened" }), DELIVERY_ID);
    expect(result?.type).toBe("github.issue.reopened");
  });

  it("safely ignores an unknown issues action", () => {
    const result = normalizeGitHubEvent(issuesEvent({ action: "assigned" }), DELIVERY_ID);
    expect(result).toBeNull();
  });

  it("preserves issue number, title, and url in data", () => {
    const result = normalizeGitHubEvent(issuesEvent(), DELIVERY_ID);
    expect(result?.data).toEqual({
      number: 18,
      title: "Leaderboard not updating",
      url: "https://github.com/octocat/hello-world/issues/18",
    });
  });
});

describe("normalizeGitHubEvent — common fields", () => {
  it("preserves githubRepositoryId (as a string) and fullName", () => {
    const result = normalizeGitHubEvent(pushEvent({ repositoryId: 999888, repositoryFullName: "acme/widgets" }), DELIVERY_ID);
    expect(result?.repository).toEqual({ githubRepositoryId: "999888", fullName: "acme/widgets" });
  });

  it("preserves the actor's GitHub username", () => {
    const result = normalizeGitHubEvent(pushEvent({ actor: "someone-else" }), DELIVERY_ID);
    expect(result?.actor).toEqual({ githubUsername: "someone-else" });
  });

  it("preserves the delivery id passed in", () => {
    const result = normalizeGitHubEvent(pushEvent(), "specific-delivery-id-999");
    expect(result?.deliveryId).toBe("specific-delivery-id-999");
  });

  it("sets occurredAt to a valid ISO timestamp", () => {
    const before = Date.now();
    const result = normalizeGitHubEvent(pushEvent(), DELIVERY_ID);
    const occurredAtMs = result ? new Date(result.occurredAt).getTime() : NaN;
    expect(occurredAtMs).toBeGreaterThanOrEqual(before);
    expect(occurredAtMs).toBeLessThanOrEqual(Date.now());
  });

  it("always sets source to \"github\"", () => {
    expect(normalizeGitHubEvent(pushEvent(), DELIVERY_ID)?.source).toBe("github");
    expect(normalizeGitHubEvent(pullRequestEvent(), DELIVERY_ID)?.source).toBe("github");
    expect(normalizeGitHubEvent(issuesEvent(), DELIVERY_ID)?.source).toBe("github");
  });

  it("assigns a unique id to each normalized event", () => {
    const first = normalizeGitHubEvent(pushEvent(), DELIVERY_ID);
    const second = normalizeGitHubEvent(pushEvent(), DELIVERY_ID);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(first?.id).not.toBe(second?.id);
  });
});
