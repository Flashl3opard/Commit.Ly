import { z } from "zod";

// Mirrors github-service's kafka.events.ts envelope + GithubEventData
// shape. Kept as Chat Service's own independent Zod schema rather than
// importing across services — Chat Service must never depend on GitHub
// Service's internal modules (same reasoning as SYSTEM_EVENT_TYPES in
// systemMessage.validation.ts already being a duplicated literal union,
// not a cross-service import). Chat Service does not trust a Kafka
// payload just because it arrived on the expected topic; every field is
// re-validated here before touching the database.

const GITHUB_EVENT_TYPES = [
  "github.push",
  "github.pull_request.opened",
  "github.pull_request.closed",
  "github.pull_request.reopened",
  "github.pull_request.merged",
  "github.issue.opened",
  "github.issue.closed",
  "github.issue.reopened",
] as const;

const githubHttpsUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://github.com/"), { message: "URL must be an https://github.com/ link" });

// Deliberately permissive on unknown metadata keys (no .strict()) —
// unlike the internal HTTP endpoint this replaces, the Kafka contract is
// versioned (see `version` below) specifically so a future producer can
// add fields without every consumer needing a simultaneous deploy. Known
// fields are still fully validated.
const metadataSchema = z.object({
  githubRepositoryId: z.string().min(1),
  githubUsername: z.string().min(1),
  branch: z.string().min(1).optional(),
  baseBranch: z.string().min(1).optional(),
  commitCount: z.number().int().min(0).optional(),
  afterSha: z.string().min(1).optional(),
  number: z.number().int().optional(),
  title: z.string().optional(),
  url: githubHttpsUrlSchema.optional(),
});

const MAX_CONTENT_LENGTH = 4000;

const githubEventDataSchema = z.object({
  id: z.string().min(1),
  source: z.literal("github"),
  type: z.enum(GITHUB_EVENT_TYPES),
  deliveryId: z.string().min(1),
  repository: z.object({
    githubRepositoryId: z.string().min(1),
    fullName: z.string().min(1),
  }),
  actor: z.object({ githubUsername: z.string().min(1) }),
  data: z.record(z.string(), z.unknown()),
  occurredAt: z.string().min(1),
  roomId: z.string().uuid(),
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  metadata: metadataSchema,
});

// version is currently always 1 — a future breaking change to the
// envelope/data shape increments this, and this schema (or a sibling
// v2 schema selected by this field) is what lets old and new envelopes
// be told apart without guessing from shape alone.
export const githubEventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(GITHUB_EVENT_TYPES),
  source: z.literal("github-service"),
  occurredAt: z.string().min(1),
  version: z.literal(1),
  data: githubEventDataSchema,
});

export type GithubEventEnvelope = z.infer<typeof githubEventEnvelopeSchema>;

export class InvalidGithubEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGithubEventError";
  }
}

/**
 * Parses and validates a raw Kafka message value. Never trusts the
 * payload just because it arrived on github.events — a malformed or
 * unversioned message throws InvalidGithubEventError, which the consumer
 * treats as a permanent failure (routed to the DLQ, not retried
 * indefinitely — see kafka.consumer.ts).
 */
export function parseGithubEventMessage(rawValue: string): GithubEventEnvelope {
  let json: unknown;
  try {
    json = JSON.parse(rawValue);
  } catch {
    throw new InvalidGithubEventError("Kafka message value is not valid JSON");
  }

  const result = githubEventEnvelopeSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidGithubEventError(`Invalid github.events envelope: ${result.error.message}`);
  }

  return result.data;
}
