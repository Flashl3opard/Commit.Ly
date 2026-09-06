// The normalized event contract downstream services (Room Service, Chat
// Service) are ever exposed to. Neither service should ever need to know
// GitHub's raw webhook payload shape — this is the sole boundary between
// "GitHub-specific knowledge" (Stage A parsing) and "Commit.ly domain
// knowledge" (Stage C: room lookup, system messages).

export type NormalizedEventType =
  | "github.push"
  | "github.pull_request.opened"
  | "github.pull_request.closed"
  | "github.pull_request.reopened"
  | "github.pull_request.merged"
  | "github.issue.opened"
  | "github.issue.closed"
  | "github.issue.reopened";

export type NormalizedRepository = {
  githubRepositoryId: string;
  fullName: string;
};

export type NormalizedActor = {
  githubUsername: string;
};

export type PushEventData = {
  branch: string;
  commitCount: number;
  afterSha: string;
};

export type PullRequestEventData = {
  number: number;
  title: string;
  url: string;
  branch: string;
  /** Only ever populated for github.pull_request.merged, when GitHub provided it. Never fabricated. */
  baseBranch?: string;
};

export type IssueEventData = {
  number: number;
  title: string;
  url: string;
};

export type NormalizedGitHubEvent =
  | {
      id: string;
      source: "github";
      type: "github.push";
      deliveryId: string;
      repository: NormalizedRepository;
      actor: NormalizedActor;
      data: PushEventData;
      occurredAt: string;
    }
  | {
      id: string;
      source: "github";
      type:
        | "github.pull_request.opened"
        | "github.pull_request.closed"
        | "github.pull_request.reopened"
        | "github.pull_request.merged";
      deliveryId: string;
      repository: NormalizedRepository;
      actor: NormalizedActor;
      data: PullRequestEventData;
      occurredAt: string;
    }
  | {
      id: string;
      source: "github";
      type: "github.issue.opened" | "github.issue.closed" | "github.issue.reopened";
      deliveryId: string;
      repository: NormalizedRepository;
      actor: NormalizedActor;
      data: IssueEventData;
      occurredAt: string;
    };
