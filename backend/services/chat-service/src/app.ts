import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Ensures any unhandled error reaches the client as clean JSON, never
// Express's default HTML stack trace page.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
