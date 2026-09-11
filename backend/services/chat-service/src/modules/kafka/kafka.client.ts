import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import { getConfiguredKafka, isKafkaConfigured, kafkaConfig } from "./kafka.config";

// One long-lived Kafka client for the whole process — a single consumer
// (github.events, commitly-chat-service group) plus a single producer
// (used only to publish to the DLQ topic on permanent failure). Lazily
// constructed so importing this module is always safe even when Kafka is
// unconfigured.
let kafka: Kafka | null = null;
let consumer: Consumer | null = null;
let dlqProducer: Producer | null = null;
let consumerConnectPromise: Promise<void> | null = null;
let dlqProducerConnectPromise: Promise<void> | null = null;

function getKafka(): Kafka {
  if (!kafka) {
    const config = getConfiguredKafka();
    kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.WARN,
      // Same small bounded retry as github-service's producer — smooths
      // over brief broker hiccups without becoming a second retry
      // framework. Message-level retry-vs-DLQ policy lives in
      // kafka.consumer.ts, not here.
      retry: {
        retries: 3,
        initialRetryTime: 300,
        maxRetryTime: 5000,
      },
    });
  }
  return kafka;
}

/** Connects (once) and returns the shared github.events consumer. */
export async function connectConsumer(): Promise<Consumer> {
  if (!isKafkaConfigured()) {
    throw new Error("Kafka is not configured (KAFKA_BROKERS is unset)");
  }

  if (!consumer) {
    consumer = getKafka().consumer({ groupId: kafkaConfig.groupId });
  }

  if (!consumerConnectPromise) {
    consumerConnectPromise = consumer.connect();
  }

  await consumerConnectPromise;
  return consumer;
}

/** Connects (once) and returns the shared DLQ producer. */
export async function connectDlqProducer(): Promise<Producer> {
  if (!isKafkaConfigured()) {
    throw new Error("Kafka is not configured (KAFKA_BROKERS is unset)");
  }

  if (!dlqProducer) {
    dlqProducer = getKafka().producer({ allowAutoTopicCreation: false });
  }

  if (!dlqProducerConnectPromise) {
    dlqProducerConnectPromise = dlqProducer.connect();
  }

  await dlqProducerConnectPromise;
  return dlqProducer;
}

/** Clean shutdown — disconnects whichever of consumer/DLQ producer were ever connected. */
export async function disconnectKafkaClients(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    consumerConnectPromise = null;
  }
  if (dlqProducer) {
    await dlqProducer.disconnect();
    dlqProducer = null;
    dlqProducerConnectPromise = null;
  }
}
