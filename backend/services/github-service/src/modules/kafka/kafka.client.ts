import { Kafka, logLevel, type Producer } from "kafkajs";
import { getConfiguredKafka, isKafkaConfigured } from "./kafka.config";

// One long-lived Kafka client + producer for the whole process (per spec:
// never open a connection per message). Lazily constructed on first use
// rather than at module-load time so importing this module is always
// safe even when Kafka is unconfigured — callers check isKafkaConfigured()
// before touching this, but the lazy init is a second layer of safety.
let kafka: Kafka | null = null;
let producer: Producer | null = null;
let connectPromise: Promise<void> | null = null;

function getKafka(): Kafka {
  if (!kafka) {
    const config = getConfiguredKafka();
    kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      // KafkaJS defaults to fairly chatty INFO logs; this service already
      // has its own structured logging around the event lifecycle (see
      // kafka.producer.ts), so KafkaJS's own logs are dropped to WARN to
      // avoid duplicate/noisy output. Never NOTHING — a broker-level
      // connection failure should still surface somewhere.
      logLevel: logLevel.WARN,
      // Bounded retry for transient broker/network failures (connection
      // refused, leader election in progress, etc.) — small and explicit
      // rather than relying on KafkaJS's undocumented-in-our-code default.
      // A GitHub webhook delivery is itself already retried by GitHub on a
      // 502 (see githubWebhook.controller.ts), so this only needs to
      // smooth over brief Kafka hiccups within a single publish attempt,
      // not replace that outer retry loop.
      retry: {
        retries: 3,
        initialRetryTime: 300,
        maxRetryTime: 5000,
      },
    });
  }
  return kafka;
}

/**
 * Connects the shared producer if not already connected/connecting.
 * Idempotent and concurrency-safe: multiple simultaneous callers await
 * the same in-flight connect rather than each starting their own.
 */
export async function connectProducer(): Promise<Producer> {
  if (!isKafkaConfigured()) {
    throw new Error("Kafka is not configured (KAFKA_BROKERS is unset)");
  }

  if (!producer) {
    producer = getKafka().producer({ allowAutoTopicCreation: false });
  }

  if (!connectPromise) {
    connectPromise = producer.connect();
  }

  await connectPromise;
  return producer;
}

/** Clean shutdown — disconnects the producer if one was ever connected. */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    connectPromise = null;
  }
}
