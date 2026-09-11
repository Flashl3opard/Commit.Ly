import { connectDlqProducer } from "./kafka.client";
import { kafkaConfig } from "./kafka.config";

export type DlqErrorClassification = "invalid_event" | "processing_failure";

export type DlqRecord = {
  eventId: string | null;
  eventType: string | null;
  originalTopic: string;
  errorClassification: DlqErrorClassification;
  errorMessage: string;
  failedAt: string;
  /** The raw message value as received, so a human can inspect/replay it. Never omitted just because parsing failed — that is exactly the case where the raw bytes are most needed for diagnosis. */
  originalPayload: string;
};

function log(message: string, fields: Record<string, string>) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[event] ${message} ${parts}`);
}

/**
 * Publishes an unprocessable github.events message to the dead-letter
 * topic, retaining enough metadata to diagnose the failure without
 * needing to reproduce it: event id/type (when known — a malformed
 * message may not have a parseable id), the original topic, an error
 * classification (permanent vs. exhausted-retries), when it failed, and
 * the raw original payload.
 *
 * Never throws on its own failure path — being unable to publish would
 * otherwise risk the consumer being stuck retrying forever — instead this
 * logs and returns, and the caller (kafka.consumer.ts) still commits the
 * offset so the partition keeps moving. A DLQ publish failure is visible
 * in logs, not a silent data loss — the alternative (blocking the whole
 * topic on one unprocessable message) is worse.
 */
export async function publishToDlq(record: DlqRecord): Promise<void> {
  log("routing to DLQ", {
    eventId: record.eventId ?? "unknown",
    eventType: record.eventType ?? "unknown",
    classification: record.errorClassification,
  });

  try {
    const producer = await connectDlqProducer();
    await producer.send({
      topic: kafkaConfig.githubEventsDlqTopic,
      messages: [
        {
          key: record.eventId ?? undefined,
          value: JSON.stringify(record),
        },
      ],
    });
  } catch (err) {
    log("DLQ publish failed — offset will still be committed to avoid blocking the partition", {
      eventId: record.eventId ?? "unknown",
      eventType: record.eventType ?? "unknown",
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
}
