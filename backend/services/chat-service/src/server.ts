import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { attachWebSocketServer } from "./modules/ws/wsServer";
import { isKafkaConfigured } from "./modules/kafka/kafka.config";
import { startGithubEventsConsumer } from "./modules/kafka/kafka.consumer";
import { disconnectKafkaClients } from "./modules/kafka/kafka.client";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4004;

// A plain http.Server is created explicitly (rather than app.listen()
// directly) so the WebSocket server can hook the same server's 'upgrade'
// event — ws runs alongside the REST API on the same port, not as a
// separate service.
const server = createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Kafka is optional at startup (see kafka.config.ts) — every existing
// REST/WebSocket path must keep working even when it's unconfigured or
// the broker is briefly unreachable. A failure to start the consumer is
// logged, not thrown: the service stays up in a degraded state (GitHub
// activity delivery paused; every other feature unaffected) rather than
// crashing with an obscure stack trace, per the existing GitHub App
// degraded-startup precedent (githubApp.config.ts).
if (isKafkaConfigured()) {
  startGithubEventsConsumer().catch((err) => {
    console.error("Failed to start github.events consumer — GitHub activity delivery is degraded.", err);
  });
} else {
  console.log("Kafka is not configured (KAFKA_BROKERS unset) — github.events consumer not started.");
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  server.close();

  try {
    await disconnectKafkaClients();
  } catch (err) {
    console.error("Error disconnecting Kafka clients during shutdown", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
