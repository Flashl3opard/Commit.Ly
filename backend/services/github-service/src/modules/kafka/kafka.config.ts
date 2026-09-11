// Kafka configuration is optional at startup, same reasoning as
// githubApp.config.ts: the service must still boot (and every non-Kafka
// code path must keep working) even if Kafka is not configured or not
// currently reachable — never a throw-at-import-time like internal.ts's
// INTERNAL_SERVICE_SECRET, since that HTTP boundary is required for the
// service to do anything useful at all, while Kafka backs exactly one
// event-publishing path.

const KAFKA_BROKERS = process.env.KAFKA_BROKERS;
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? "commitly-github-service";
const KAFKA_GITHUB_EVENTS_TOPIC = process.env.KAFKA_GITHUB_EVENTS_TOPIC ?? "github.events";
const KAFKA_GITHUB_EVENTS_DLQ_TOPIC = process.env.KAFKA_GITHUB_EVENTS_DLQ_TOPIC ?? "github.events.dlq";

type KafkaConfig = {
  brokers: string[] | undefined;
  clientId: string;
  githubEventsTopic: string;
  githubEventsDlqTopic: string;
};

export const kafkaConfig: KafkaConfig = {
  brokers: KAFKA_BROKERS ? KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean) : undefined,
  clientId: KAFKA_CLIENT_ID,
  githubEventsTopic: KAFKA_GITHUB_EVENTS_TOPIC,
  githubEventsDlqTopic: KAFKA_GITHUB_EVENTS_DLQ_TOPIC,
};

/** True only when enough configuration exists to attempt a Kafka connection. */
export function isKafkaConfigured(): boolean {
  return Boolean(kafkaConfig.brokers && kafkaConfig.brokers.length > 0);
}

export type ConfiguredKafka = KafkaConfig & { brokers: string[] };

export function getConfiguredKafka(): ConfiguredKafka {
  if (!isKafkaConfigured()) {
    throw new Error("getConfiguredKafka() called while Kafka is not configured");
  }
  return kafkaConfig as ConfiguredKafka;
}
