import { connectProducer } from "./kafka.client";
import { kafkaConfig } from "./kafka.config";
import { buildGithubEventEnvelope, type GithubEventMessage } from "./kafka.events";
import type { NormalizedGitHubEvent } from "../github-events/normalizedEvent";

export class KafkaPublishError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "KafkaPublishError";
  }
}

// Safe, structured log line — mirrors githubWebhook.controller.ts's own
// log() helper (never the raw payload, never a secret/token).
function log(message: string, fields: Record<string, string>) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[event] ${message} ${parts}`);
}

/**
 * Publishes a normalized GitHub event to github.events, keyed by roomId.
 *
 * Key choice: roomId, not eventId or repositoryId. Kafka only guarantees
 * ordering within a single partition, and the ordering guarantee that
 * actually matters here is "this room's activity feed renders in the
 * order it happened" — e.g. a push followed immediately by a PR merge in
 * the same room must not be consumed out of order. Keying by roomId sends
 * every event for a room to the same partition, preserving that order.
 * repositoryId was considered but rejected: a room maps to exactly one
 * repository today (Room.githubRepositoryId is @unique), so keying by
 * repositoryId vs roomId produces identical partition assignment in the
 * current architecture — roomId is chosen because it's the identifier
 * Chat Service's consumer actually needs downstream (see
 * chat-service/src/modules/kafka/kafka.consumer.ts), so no
 * repository-id-to-room-id indirection is needed for partitioning either.
 *
 * Never publishes before the caller has already validated + normalized
 * the event and resolved roomId — this function has no knowledge of raw
 * webhook payloads. Throws KafkaPublishError on any failure (Kafka
 * unconfigured, broker unreachable after KafkaJS's own internal retries,
 * serialization failure); it never silently reports success on a message
 * that was not actually accepted by the broker — callers must treat a
 * throw here as "downstream processing failed", the same way the
 * pre-Kafka synchronous Chat Service HTTP call did.
 */
export async function publishGithubEvent(
  event: NormalizedGitHubEvent,
  roomId: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const envelope: GithubEventMessage = buildGithubEventEnvelope(event, roomId, content, metadata);

  log("publishing", { eventId: envelope.eventId, type: envelope.eventType, roomId });

  try {
    const producer = await connectProducer();
    await producer.send({
      topic: kafkaConfig.githubEventsTopic,
      messages: [
        {
          key: roomId,
          value: JSON.stringify(envelope),
        },
      ],
    });
  } catch (err) {
    log("publish failed", {
      eventId: envelope.eventId,
      type: envelope.eventType,
      roomId,
      error: err instanceof Error ? err.message : "unknown error",
    });
    throw new KafkaPublishError(`Failed to publish ${envelope.eventType} to Kafka`, err);
  }

  log("published", { eventId: envelope.eventId, type: envelope.eventType, roomId });
}
