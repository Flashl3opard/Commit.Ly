import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { channelMessagesRouter, roomMessagesRouter } from "./modules/message/message.routes";
import { messageByIdRouter } from "./modules/message/messageById.routes";
import systemMessageRoutes from "./modules/message/systemMessage.routes";
import { conversationsRouter, messagesRouter as dmMessagesRouter } from "./modules/dm/dm.routes";
import { isKafkaConfigured } from "./modules/kafka/kafka.config";
import { isConsumerRunning } from "./modules/kafka/kafka.consumer";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use("/internal", systemMessageRoutes);
app.use("/rooms/:roomId/channels/:channelId/messages", channelMessagesRouter);
app.use("/rooms/:roomId/messages", roomMessagesRouter);
app.use("/messages/:messageId", messageByIdRouter);
app.use("/dm/conversations", conversationsRouter);
app.use("/dm/messages", dmMessagesRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Distinct from /health: this service is "healthy" (accepting REST/
// WebSocket traffic) independent of whether Kafka is configured or
// connected — Kafka backs exactly one optional feature (GitHub activity
// delivery), not the service's core purpose, so /health never reflects
// its state. /ready exposes that dependency's state explicitly for
// anyone who wants to check it (monitoring, local dev), always 200 —
// this is informational, not a liveness/readiness gate other systems
// should fail deploys on. Never exposes broker addresses or credentials.
app.get("/ready", (_req, res) => {
  res.status(200).json({
    status: "ok",
    kafka: {
      configured: isKafkaConfigured(),
      githubEventsConsumerRunning: isConsumerRunning(),
    },
  });
});

// Ensures any unhandled error reaches the client as clean JSON, never
// Express's default HTML stack trace page.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
