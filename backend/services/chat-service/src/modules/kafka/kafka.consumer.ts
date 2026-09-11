import type { EachMessagePayload } from "kafkajs";
import { connectConsumer } from "./kafka.client";
import { kafkaConfig } from "./kafka.config";
import { parseGithubEventMessage, InvalidGithubEventError, type GithubEventEnvelope } from "./kafka.events";
import { publishToDlq } from "./kafka.dlq";
import { createSystemMessage, MessageServiceError } from "../message/message.service";
import { broadcastMessageEvent } from "../ws/wsServer";
import type { CreateSystemMessageInput } from "../message/systemMessage.validation";

// Bounded, in-handler retry for transient failures only (Room Service
// briefly unreachable, a transient Postgres error) — deliberately small
// per the "do not build a massive retry framework" guidance. This is
// separate from KafkaJS's own client-level connection retry (see
// kafka.client.ts) and from GitHub's webhook-delivery retry (a different
// layer entirely, upstream of Kafka) — this one only governs how many
// times *this consumer* re-attempts processing a single already-received
// message before giving up on it and routing to the DLQ.
const MAX_PROCESSING_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

function log(message: string, fields: Record<string, string>) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[event] ${message} ${parts}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for failures worth retrying a few times before giving up (network/DB blips); false for failures no retry will ever fix. */
function isTransient(err: unknown): boolean {
  if (err instanceof MessageServiceError) {
    // 502 = Room Service was unreachable when resolving the default
    // channel — genuinely transient. 404 (room/channel not found) is not:
    // retrying will never make a nonexistent room appear.
    return err.status === 502;
  }
  // Anything else uncaught (e.g. a Postgres connection error bubbling up
  // from Prisma) is treated as transient — the alternative (treating an
  // unrecognized error as permanent) risks DLQing events that would have
  // succeeded on the next attempt after a brief outage.
  return true;
}

/**
 * Processes one already-validated github.events envelope: creates the
 * system message (reusing the exact same createSystemMessage the HTTP
 * path uses — no second implementation) and broadcasts it over the
 * existing WebSocket path, exactly as the pre-Kafka synchronous flow did.
 * A duplicate delivery (created: false) is logged and NOT re-broadcast —
 * the original create already broadcast it once.
 */
async function processEvent(envelope: GithubEventEnvelope): Promise<void> {
  const { data } = envelope;
  const input: CreateSystemMessageInput = {
    eventType: data.type,
    content: data.content,
    metadata: data.metadata as CreateSystemMessageInput["metadata"],
  };

  const { message, created } = await createSystemMessage(data.roomId, input, envelope.eventId);

  if (!created) {
    log("duplicate event ignored (already processed)", {
      eventId: envelope.eventId,
      type: envelope.eventType,
      messageId: message.id,
    });
    return;
  }

  broadcastMessageEvent(message.roomId, "message.created", message);

  log("processed", {
    eventId: envelope.eventId,
    type: envelope.eventType,
    messageId: message.id,
  });
}

/**
 * Handles one raw Kafka message end-to-end: parse/validate, then process
 * with bounded retry for transient failures, then DLQ for anything that
 * either fails validation outright or exhausts its retries. Always
 * resolves (never throws) — the caller commits the offset unconditionally
 * after this returns, whether the outcome was success or DLQ, so a single
 * bad message can never wedge the partition.
 */
export async function handleGithubEventMessage(rawValue: string | null): Promise<void> {
  if (rawValue === null) {
    return;
  }

  let envelope: GithubEventEnvelope;
  try {
    envelope = parseGithubEventMessage(rawValue);
  } catch (err) {
    const message = err instanceof InvalidGithubEventError ? err.message : "Unknown parse error";
    log("malformed event rejected", { error: message });
    await publishToDlq({
      eventId: null,
      eventType: null,
      originalTopic: kafkaConfig.githubEventsTopic,
      errorClassification: "invalid_event",
      errorMessage: message,
      failedAt: new Date().toISOString(),
      originalPayload: rawValue,
    });
    return;
  }

  log("consumed", { eventId: envelope.eventId, type: envelope.eventType, roomId: envelope.data.roomId });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt += 1) {
    try {
      await processEvent(envelope);
      return;
    } catch (err) {
      lastError = err;

      if (!isTransient(err)) {
        break;
      }

      if (attempt < MAX_PROCESSING_ATTEMPTS) {
        log("transient processing failure, retrying", {
          eventId: envelope.eventId,
          type: envelope.eventType,
          attempt: String(attempt),
          error: err instanceof Error ? err.message : "unknown error",
        });
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : "Unknown processing error";
  log("processing failed after retries, routing to DLQ", {
    eventId: envelope.eventId,
    type: envelope.eventType,
    error: errorMessage,
  });
  await publishToDlq({
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    originalTopic: kafkaConfig.githubEventsTopic,
    errorClassification: isTransient(lastError) ? "processing_failure" : "invalid_event",
    errorMessage,
    failedAt: new Date().toISOString(),
    originalPayload: rawValue,
  });
}

let running = false;

/**
 * Starts the github.events consumer loop. Idempotent — a second call
 * while already running is a no-op rather than a second subscription.
 * Uses Kafka's own consumer-offset mechanism for resume-after-restart
 * (no manual offset tracking in PostgreSQL) — eachMessage resolving is
 * what allows KafkaJS to advance the committed offset, and
 * handleGithubEventMessage always resolves (see its own doc comment), so
 * every message — successfully processed or DLQ'd — advances the offset
 * exactly once.
 */
export async function startGithubEventsConsumer(): Promise<void> {
  if (running) return;

  const consumer = await connectConsumer();
  await consumer.subscribe({ topic: kafkaConfig.githubEventsTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      await handleGithubEventMessage(message.value ? message.value.toString("utf8") : null);
    },
  });

  running = true;
  log("consumer started", { topic: kafkaConfig.githubEventsTopic, groupId: kafkaConfig.groupId });
}

export function isConsumerRunning(): boolean {
  return running;
}
