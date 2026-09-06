import { Router } from "express";
import express from "express";
import { receiveWebhook } from "./githubWebhook.controller";

const router = Router();

// Raw body is required so HMAC signature verification runs against the
// EXACT bytes GitHub sent — never a re-parsed/re-serialized JSON body.
// This is scoped to this route only; it must not affect the global
// express.json() parsing used by every other REST endpoint in this
// service, so it is mounted here rather than as app-level middleware.
router.post("/", express.raw({ type: "application/json", limit: "5mb" }), receiveWebhook);

export default router;
