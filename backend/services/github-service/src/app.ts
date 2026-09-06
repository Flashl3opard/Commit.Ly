import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import githubRoutes from "./modules/github/github.routes";
import githubAppRoutes from "./modules/github-app/githubApp.routes";
import internalRoutes from "./modules/internal/internal.routes";
import githubWebhookRoutes from "./modules/github-webhook/githubWebhook.routes";

const app = express();

// Mounted BEFORE the global express.json() parser below. GitHub's webhook
// signature must be verified against the exact raw request bytes; if the
// global JSON parser ran first, the original payload would already be
// consumed/parsed and unavailable for HMAC verification. This route does
// not use authMiddleware — GitHub authenticates via its own HMAC
// signature, not our JWT cookie.
app.use("/github/webhooks", githubWebhookRoutes);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use("/github", githubRoutes);
app.use("/github/app", githubAppRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
