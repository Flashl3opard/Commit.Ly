import { randomUUID } from "node:crypto";
import type { ParsedIssuesEvent, ParsedPullRequestEvent, ParsedPushEvent, ParsedSupportedEvent } from "../github-webhook/webhookEvent.schemas";
import type { NormalizedGitHubEvent } from "./normalizedEvent";

/**
 * Extracts a short branch name from a git ref, e.g. "refs/heads/main" ->
 * "main". Only `refs/heads/...` (branch) refs are treated as a branch push;
 * anything else (tags, refs/pull/..., etc.) is not a normal branch push and
 * is safely ignored by the caller rather than guessing a display name.
 */
function branchFromRef(ref: string): string | null {
  const prefix = "refs/heads/";
  if (!ref.startsWith(prefix)) return null;
  const branch = ref.slice(prefix.length);
  return branch.length > 0 ? branch : null;
}

function normalizePush(event: ParsedPushEvent, deliveryId: string, occurredAt: string): NormalizedGitHubEvent | null {
  const branch = branchFromRef(event.ref);
  if (!branch) {
    // Tag push, PR ref, or some other non-branch ref — not part of the MVP.
    return null;
  }

  return {
    id: randomUUID(),
    source: "github",
    type: "github.push",
    deliveryId,
    repository: { githubRepositoryId: String(event.repositoryId), fullName: event.repositoryFullName },
    actor: { githubUsername: event.actor },
    data: { branch, commitCount: event.commitCount, afterSha: event.after },
    occurredAt,
  };
}

function normalizePullRequest(
  event: ParsedPullRequestEvent,
  deliveryId: string,
  occurredAt: string,
): NormalizedGitHubEvent | null {
  const base = {
    id: randomUUID(),
    source: "github" as const,
    deliveryId,
    repository: { githubRepositoryId: String(event.repositoryId), fullName: event.repositoryFullName },
    actor: { githubUsername: event.actor },
    occurredAt,
  };

  const data = {
    number: event.prNumber,
    title: event.prTitle,
    url: event.prUrl,
    branch: event.headBranch ?? "",
    ...(event.merged && event.baseBranch ? { baseBranch: event.baseBranch } : {}),
  };

  switch (event.action) {
    case "opened":
      return { ...base, type: "github.pull_request.opened", data };
    case "reopened":
      return { ...base, type: "github.pull_request.reopened", data };
    case "closed":
      // A closed PR is only "merged" when GitHub explicitly says so —
      // closing a PR without merging is a distinct, more common outcome.
      return { ...base, type: event.merged ? "github.pull_request.merged" : "github.pull_request.closed", data };
    default:
      // Unknown/unhandled action (e.g. "synchronize", "labeled") — safely ignored.
      return null;
  }
}

function normalizeIssue(event: ParsedIssuesEvent, deliveryId: string, occurredAt: string): NormalizedGitHubEvent | null {
  const base = {
    id: randomUUID(),
    source: "github" as const,
    deliveryId,
    repository: { githubRepositoryId: String(event.repositoryId), fullName: event.repositoryFullName },
    actor: { githubUsername: event.actor },
    data: { number: event.issueNumber, title: event.issueTitle, url: event.issueUrl },
    occurredAt,
  };

  switch (event.action) {
    case "opened":
      return { ...base, type: "github.issue.opened" };
    case "closed":
      return { ...base, type: "github.issue.closed" };
    case "reopened":
      return { ...base, type: "github.issue.reopened" };
    default:
      return null;
  }
}

/**
 * Converts an already-validated Stage A parsed event into the normalized
 * internal event contract. Pure function: no I/O, no side effects, no
 * message creation. Deliberately accepts only `ParsedSupportedEvent` (never
 * `req.body` / arbitrary JSON) — GitHub-payload-specific knowledge stays
 * confined to Stage A's parsing, not here.
 *
 * Returns null for a structurally valid but semantically unhandled event
 * (unknown action, non-branch push ref) — callers must treat that as "safely
 * ignore", not an error.
 */
export function normalizeGitHubEvent(event: ParsedSupportedEvent, deliveryId: string): NormalizedGitHubEvent | null {
  const occurredAt = new Date().toISOString();

  switch (event.kind) {
    case "push":
      return normalizePush(event, deliveryId, occurredAt);
    case "pull_request":
      return normalizePullRequest(event, deliveryId, occurredAt);
    case "issues":
      return normalizeIssue(event, deliveryId, occurredAt);
  }
}
