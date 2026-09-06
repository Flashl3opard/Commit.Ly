import type { Request, Response } from "express";
import { githubAppConfig } from "../github-app/githubApp.config";
import { verifyWebhookSignature } from "./webhookSignature";
import { isDeliveryCompleted, markDeliveryCompleted } from "./deliveryStore";
import { parseIssuesEvent, parsePullRequestEvent, parsePushEvent } from "./webhookEvent.schemas";
import type { ParsedSupportedEvent } from "./webhookEvent.schemas";
import { normalizeGitHubEvent } from "../github-events/eventNormalizer";
import { handleNormalizedGitHubEvent } from "../github-events/eventHandler";

// Events we act on in this stage. Anything else is safely ignored (200,
// not an error) — GitHub sends many event types (installation, star,
// member, ...) and an unrecognized one is not a malformed request.
const SUPPORTED_EVENTS = new Set(["push", "pull_request", "issues"]);

function parseSupportedEvent(eventName: string, body: unknown): ParsedSupportedEvent | null {
  switch (eventName) {
    case "push":
      return parsePushEvent(body);
    case "pull_request":
      return parsePullRequestEvent(body);
    case "issues":
      return parseIssuesEvent(body);
    default:
      return null;
  }
}

// Safe, structured log line — never the raw payload, secret, or any token.
function log(message: string, fields: Record<string, string>) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`${message} ${parts}`);
}

export async function receiveWebhook(req: Request, res: Response) {
  // Route-level raw-body middleware guarantees req.body is a Buffer here.
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);

  const signatureHeader = req.header("X-Hub-Signature-256");
  const eventName = req.header("X-GitHub-Event");
  const deliveryId = req.header("X-GitHub-Delivery");

  const verification = verifyWebhookSignature(rawBody, signatureHeader, githubAppConfig.webhookSecret);
  if (!verification.valid) {
    // Generic response regardless of which check failed — never reveal to
    // an attacker whether the secret is unconfigured, the header is
    // malformed, or the digest simply didn't match.
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  if (!eventName || !deliveryId) {
    return res.status(400).json({ error: "Missing required GitHub webhook headers" });
  }

  log("GitHub webhook received", { event: eventName, deliveryId });

  if (isDeliveryCompleted(deliveryId)) {
    // Already fully processed on a previous attempt — GitHub retried after
    // we returned success (or this is a duplicate delivery). Acknowledge
    // without reprocessing; do not create a second message.
    log("Duplicate delivery, already completed", { event: eventName, deliveryId });
    return res.status(200).json({ ok: true });
  }

  if (!SUPPORTED_EVENTS.has(eventName)) {
    // Valid, well-formed, just not an event we act on yet — still a
    // successful receipt from GitHub's perspective. Safe to mark completed
    // immediately since there is no downstream work to retry.
    markDeliveryCompleted(deliveryId);
    return res.status(200).json({ ok: true, ignored: true });
  }

  let parsedBody: unknown;
  try {
    parsedBody = rawBody.length > 0 ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    return res.status(400).json({ error: "Malformed webhook payload" });
  }

  const parsedEvent = parseSupportedEvent(eventName, parsedBody);
  if (!parsedEvent) {
    // Structurally unusable payload for a supported event type — reject
    // without writing anything or calling any downstream service, but
    // don't treat it as a signature/auth failure. Not marked completed:
    // this is a malformed request, not a processed one, though GitHub is
    // unlikely to usefully retry a payload that will parse the same way.
    return res.status(422).json({ error: "Unprocessable webhook payload" });
  }

  const normalized = normalizeGitHubEvent(parsedEvent, deliveryId);
  if (!normalized) {
    // Structurally valid but semantically unhandled (unknown PR/issue
    // action, non-branch push ref) — safely ignored, same as an
    // unsupported event type.
    markDeliveryCompleted(deliveryId);
    return res.status(200).json({ ok: true, ignored: true });
  }

  const result = await handleNormalizedGitHubEvent(normalized);

  switch (result.outcome) {
    case "no_room":
      // Expected, routine: this repository has no Commit.ly room. Nothing
      // was created and nothing downstream was called.
      log("GitHub event received for repo with no Commit.ly room. This is expected behavior.", {
        event: eventName,
        deliveryId,
        repositoryId: normalized.repository.githubRepositoryId,
      });
      markDeliveryCompleted(deliveryId);
      return res.status(200).json({ ok: true, ignored: true });

    case "delivered":
      log("GitHub system message created", {
        event: eventName,
        deliveryId,
        repositoryId: normalized.repository.githubRepositoryId,
        roomId: result.roomId,
      });
      markDeliveryCompleted(deliveryId);
      return res.status(200).json({ ok: true });

    case "downstream_failure":
      // Deliberately NOT marked completed — GitHub must be told to retry
      // (5xx), and the next attempt with the same delivery id must be free
      // to try again, not be swallowed as an already-completed duplicate.
      log("GitHub event downstream processing failed, delivery will be retried", {
        event: eventName,
        deliveryId,
        repositoryId: normalized.repository.githubRepositoryId,
      });
      return res.status(502).json({ error: "Downstream processing failed" });
  }
}
