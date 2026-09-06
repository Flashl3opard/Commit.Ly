import { z } from "zod";

// Mirrors the normalized event types GitHub Service produces (Stage B).
// Kept as a plain literal union rather than importing across services —
// Chat Service must never depend on GitHub Service's internal modules.
const SYSTEM_EVENT_TYPES = [
  "github.push",
  "github.pull_request.opened",
  "github.pull_request.closed",
  "github.pull_request.reopened",
  "github.pull_request.merged",
  "github.issue.opened",
  "github.issue.closed",
  "github.issue.reopened",
] as const;

const MAX_CONTENT_LENGTH = 4000;

// Only ever expect GitHub's own https URLs here — never javascript:/data:/
// arbitrary schemes. This is Chat Service's own boundary check; it does not
// trust that GitHub Service already validated the URL shape.
const githubHttpsUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://github.com/"), { message: "URL must be an https://github.com/ link" });

const metadataSchema = z
  .object({
    githubRepositoryId: z.string().min(1),
    githubUsername: z.string().min(1),
    branch: z.string().min(1).optional(),
    baseBranch: z.string().min(1).optional(),
    commitCount: z.number().int().min(0).optional(),
    afterSha: z.string().min(1).optional(),
    number: z.number().int().optional(),
    title: z.string().optional(),
    url: githubHttpsUrlSchema.optional(),
  })
  .strict();

export const createSystemMessageSchema = z
  .object({
    eventType: z.enum(SYSTEM_EVENT_TYPES),
    content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
    metadata: metadataSchema,
  })
  .strict();

export type CreateSystemMessageInput = z.infer<typeof createSystemMessageSchema>;

export { MAX_CONTENT_LENGTH, SYSTEM_EVENT_TYPES };
