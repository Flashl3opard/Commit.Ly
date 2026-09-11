import "dotenv/config";
import app from "./app";
import { disconnectProducer } from "./modules/kafka/kafka.client";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4002;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// The Kafka producer connects lazily on first publish (see kafka.client.ts)
// — there is nothing to eagerly start here, only something to cleanly
// disconnect on shutdown if it was ever connected.
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  server.close();

  try {
    await disconnectProducer();
  } catch (err) {
    console.error("Error disconnecting Kafka producer during shutdown", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
