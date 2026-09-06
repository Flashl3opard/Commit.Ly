import { describe, it, expect } from "vitest";
import { parseIssuesEvent, parsePullRequestEvent, parsePushEvent } from "./webhookEvent.schemas";

describe("parsePushEvent", () => {
  it("extracts the minimum fields from a realistic push payload", () => {
    const payload = {
      ref: "refs/heads/main",
      after: "abc123def456",
      repository: { id: 123456, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
      // Realistic payloads carry many more fields — irrelevant ones must
      // not cause validation to fail.
      commits: [{ id: "abc123def456", message: "fix: something" }],
    };

    const parsed = parsePushEvent(payload);
    expect(parsed).toEqual({
      kind: "push",
      repositoryId: 123456,
      repositoryFullName: "octocat/hello-world",
      actor: "octocat",
      ref: "refs/heads/main",
      after: "abc123def456",
      commitCount: 1,
    });
  });

  it("defaults commitCount to 0 when commits is absent", () => {
    const payload = {
      ref: "refs/heads/main",
      after: "abc123def456",
      repository: { id: 123456, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
    };
    expect(parsePushEvent(payload)?.commitCount).toBe(0);
  });

  it("returns null when repository information is missing", () => {
    const payload = { ref: "refs/heads/main", after: "abc123", sender: { login: "octocat" } };
    expect(parsePushEvent(payload)).toBeNull();
  });

  it("returns null for a completely malformed payload", () => {
    expect(parsePushEvent({ not: "a push event" })).toBeNull();
    expect(parsePushEvent(null)).toBeNull();
    expect(parsePushEvent("a string")).toBeNull();
  });
});

describe("parsePullRequestEvent", () => {
  it("extracts the minimum fields from a realistic pull_request payload", () => {
    const payload = {
      action: "opened",
      repository: { id: 555, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
      pull_request: {
        number: 42,
        title: "Add feature X",
        html_url: "https://github.com/octocat/hello-world/pull/42",
        body: "Long description text irrelevant to Stage A",
      },
    };

    const parsed = parsePullRequestEvent(payload);
    expect(parsed).toEqual({
      kind: "pull_request",
      repositoryId: 555,
      repositoryFullName: "octocat/hello-world",
      actor: "octocat",
      action: "opened",
      prNumber: 42,
      prTitle: "Add feature X",
      prUrl: "https://github.com/octocat/hello-world/pull/42",
      merged: false,
      headBranch: null,
      baseBranch: null,
    });
  });

  it("extracts merged=true and branch info from a closed+merged payload", () => {
    const payload = {
      action: "closed",
      repository: { id: 555, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
      pull_request: {
        number: 42,
        title: "Add feature X",
        html_url: "https://github.com/octocat/hello-world/pull/42",
        merged: true,
        head: { ref: "feature/x" },
        base: { ref: "main" },
      },
    };

    const parsed = parsePullRequestEvent(payload);
    expect(parsed?.merged).toBe(true);
    expect(parsed?.headBranch).toBe("feature/x");
    expect(parsed?.baseBranch).toBe("main");
  });

  it("returns null when pull_request information is missing", () => {
    const payload = { action: "opened", repository: { id: 1, full_name: "a/b" }, sender: { login: "x" } };
    expect(parsePullRequestEvent(payload)).toBeNull();
  });
});

describe("parseIssuesEvent", () => {
  it("extracts the minimum fields from a realistic issues payload", () => {
    const payload = {
      action: "opened",
      repository: { id: 777, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
      issue: {
        number: 7,
        title: "Bug: something broke",
        html_url: "https://github.com/octocat/hello-world/issues/7",
      },
    };

    const parsed = parseIssuesEvent(payload);
    expect(parsed).toEqual({
      kind: "issues",
      repositoryId: 777,
      repositoryFullName: "octocat/hello-world",
      actor: "octocat",
      action: "opened",
      issueNumber: 7,
      issueTitle: "Bug: something broke",
      issueUrl: "https://github.com/octocat/hello-world/issues/7",
    });
  });

  it("returns null when issue information is missing", () => {
    const payload = { action: "opened", repository: { id: 1, full_name: "a/b" }, sender: { login: "x" } };
    expect(parseIssuesEvent(payload)).toBeNull();
  });
});
