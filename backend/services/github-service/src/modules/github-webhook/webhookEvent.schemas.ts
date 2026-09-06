import { z } from "zod";

// GitHub webhook payloads are large and evolve independently of us. These
// schemas intentionally validate only the small subset of fields Stage A
// needs to establish that an event is structurally usable — not the full
// payload shape. Unknown/extra fields are ignored (Zod's default, non-strict
// behavior), so GitHub adding fields later does not break parsing.

const repositorySchema = z.object({
  id: z.number(),
  full_name: z.string().min(1),
});

const senderSchema = z.object({
  login: z.string().min(1),
});

export const pushEventSchema = z.object({
  repository: repositorySchema,
  sender: senderSchema,
  ref: z.string().min(1),
  after: z.string().min(1),
  // Optional: older/synthetic payloads in tests may omit it. Real GitHub
  // push payloads always include this array; commit count comes directly
  // from its length — never from a separate GitHub API call.
  commits: z.array(z.unknown()).optional(),
});

export const pullRequestEventSchema = z.object({
  repository: repositorySchema,
  sender: senderSchema,
  action: z.string().min(1),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    merged: z.boolean().optional(),
    head: z.object({ ref: z.string() }).optional(),
    base: z.object({ ref: z.string() }).optional(),
  }),
});

export const issuesEventSchema = z.object({
  repository: repositorySchema,
  sender: senderSchema,
  action: z.string().min(1),
  issue: z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
  }),
});

export type PushEventPayload = z.infer<typeof pushEventSchema>;
export type PullRequestEventPayload = z.infer<typeof pullRequestEventSchema>;
export type IssuesEventPayload = z.infer<typeof issuesEventSchema>;

export type ParsedPushEvent = {
  kind: "push";
  repositoryId: number;
  repositoryFullName: string;
  actor: string;
  ref: string;
  after: string;
  commitCount: number;
};

export type ParsedPullRequestEvent = {
  kind: "pull_request";
  repositoryId: number;
  repositoryFullName: string;
  actor: string;
  action: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  merged: boolean;
  headBranch: string | null;
  baseBranch: string | null;
};

export type ParsedIssuesEvent = {
  kind: "issues";
  repositoryId: number;
  repositoryFullName: string;
  actor: string;
  action: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
};

export type ParsedSupportedEvent = ParsedPushEvent | ParsedPullRequestEvent | ParsedIssuesEvent;

export function parsePushEvent(body: unknown): ParsedPushEvent | null {
  const result = pushEventSchema.safeParse(body);
  if (!result.success) return null;
  const { repository, sender, ref, after, commits } = result.data;
  return {
    kind: "push",
    repositoryId: repository.id,
    repositoryFullName: repository.full_name,
    actor: sender.login,
    ref,
    after,
    commitCount: commits?.length ?? 0,
  };
}

export function parsePullRequestEvent(body: unknown): ParsedPullRequestEvent | null {
  const result = pullRequestEventSchema.safeParse(body);
  if (!result.success) return null;
  const { repository, sender, action, pull_request: pr } = result.data;
  return {
    kind: "pull_request",
    repositoryId: repository.id,
    repositoryFullName: repository.full_name,
    actor: sender.login,
    action,
    prNumber: pr.number,
    prTitle: pr.title,
    prUrl: pr.html_url,
    merged: pr.merged ?? false,
    headBranch: pr.head?.ref ?? null,
    baseBranch: pr.base?.ref ?? null,
  };
}

export function parseIssuesEvent(body: unknown): ParsedIssuesEvent | null {
  const result = issuesEventSchema.safeParse(body);
  if (!result.success) return null;
  const { repository, sender, action, issue } = result.data;
  return {
    kind: "issues",
    repositoryId: repository.id,
    repositoryFullName: repository.full_name,
    actor: sender.login,
    action,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueUrl: issue.html_url,
  };
}
