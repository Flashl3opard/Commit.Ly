// Same optional-configuration reasoning as github-service's kafka.config.ts
// — Chat Service must still boot and serve every existing REST/WebSocket
// path even when Kafka is unconfigured or unreachable. Never a throw-at-
// import-time like internal.ts's INTERNAL_SERVICE_SECRET.

const KAFKA_BROKERS = process.env.KAFKA_BROKERS;
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? "commitly-chat-service";
const KAFKA_GITHUB_EVENTS_TOPIC = process.env.KAFKA_GITHUB_EVENTS_TOPIC ?? "github.events";
const KAFKA_GITHUB_EVENTS_DLQ_TOPIC = process.env.KAFKA_GITHUB_EVENTS_DLQ_TOPIC ?? "github.events.dlq";
// Stable across restarts/deploys — Kafka resumes this group from its last
// committed offset rather than replaying or skipping the topic. Must never
// change casually; changing it starts the group over from
// auto.offset.reset behavior as if it had never consumed anything.
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID ?? "commitly-chat-service";

type KafkaConfig = {
  brokers: string[] | undefined;
  clientId: string;
  groupId: string;
  githubEventsTopic: string;
  githubEventsDlqTopic: string;
};

export const kafkaConfig: KafkaConfig = {
  brokers: KAFKA_BROKERS ? KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean) : undefined,
  clientId: KAFKA_CLIENT_ID,
  groupId: KAFKA_GROUP_ID,
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
