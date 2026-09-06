import type { NormalizedGitHubEvent } from "./normalizedEvent";

/**
 * Generates the human-readable content string for a normalized GitHub
 * event, centrally — the frontend renders structured metadata plus this
 * string, rather than each client re-deriving its own copy from the event
 * type. Keeping this here (not scattered across React components) means
 * any future client (mobile, a future API) renders identical text.
 */
export function renderEventContent(event: NormalizedGitHubEvent): string {
  const actor = event.actor.githubUsername;

  switch (event.type) {
    case "github.push": {
      const { branch, commitCount } = event.data;
      const commitWord = commitCount === 1 ? "commit" : "commits";
      return `${actor} pushed ${commitCount} ${commitWord} to ${branch}`;
    }
    case "github.pull_request.opened":
      return `${actor} opened PR #${event.data.number}: ${event.data.title}`;
    case "github.pull_request.reopened":
      return `${actor} reopened PR #${event.data.number}: ${event.data.title}`;
    case "github.pull_request.closed":
      return `${actor} closed PR #${event.data.number}: ${event.data.title}`;
    case "github.pull_request.merged": {
      const target = event.data.baseBranch;
      return target
        ? `${actor} merged PR #${event.data.number} into ${target}`
        : `${actor} merged PR #${event.data.number}`;
    }
    case "github.issue.opened":
      return `${actor} opened issue #${event.data.number}: ${event.data.title}`;
    case "github.issue.closed":
      return `${actor} closed issue #${event.data.number}: ${event.data.title}`;
    case "github.issue.reopened":
      return `${actor} reopened issue #${event.data.number}: ${event.data.title}`;
  }
}

/**
 * Builds the structured metadata stored alongside a system message —
 * exactly the small, display-relevant subset (never a raw GitHub payload).
 * Field presence intentionally varies by event type; consumers should not
 * assume every field is always present.
 */
export function buildEventMetadata(event: NormalizedGitHubEvent): Record<string, unknown> {
  const base = {
    githubRepositoryId: event.repository.githubRepositoryId,
    githubUsername: event.actor.githubUsername,
  };

  switch (event.type) {
    case "github.push":
      return { ...base, branch: event.data.branch, commitCount: event.data.commitCount, afterSha: event.data.afterSha };
    case "github.pull_request.opened":
    case "github.pull_request.reopened":
    case "github.pull_request.closed":
      return {
        ...base,
        number: event.data.number,
        title: event.data.title,
        url: event.data.url,
        ...(event.data.branch ? { branch: event.data.branch } : {}),
      };
    case "github.pull_request.merged":
      return {
        ...base,
        number: event.data.number,
        title: event.data.title,
        url: event.data.url,
        ...(event.data.branch ? { branch: event.data.branch } : {}),
        ...(event.data.baseBranch ? { baseBranch: event.data.baseBranch } : {}),
      };
    case "github.issue.opened":
    case "github.issue.closed":
    case "github.issue.reopened":
      return { ...base, number: event.data.number, title: event.data.title, url: event.data.url };
  }
}
