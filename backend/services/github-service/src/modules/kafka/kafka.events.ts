import type { NormalizedGitHubEvent } from "../github-events/normalizedEvent";

// Small, generic envelope every Commit.ly Kafka event will eventually
// share (chat.events, notification.events, ... — none of which exist
// yet). Transport/routing concerns live on the envelope; everything
// domain-specific lives in `data`. Kept intentionally minimal — this is
// not a schema registry or a framework, just enough structure that a
// future consumer of a different topic can rely on the same shape.
export type EventEnvelope<TData> = {
  /** Unique per-publish id. Distinct from GitHub's X-GitHub-Delivery id (see deliveryStore.ts) — this id protects event *processing*, not webhook *ingestion*. Reused as-is from NormalizedGitHubEvent.id so one event has exactly one id across its whole lifecycle. */
  eventId: string;
  eventType: NormalizedGitHubEvent["type"];
  /** Which service produced this event — lets a consumer subscribed to multiple producers attribute events without inspecting topic name alone. */
  source: "github-service";
  occurredAt: string;
  /** Schema/version of this envelope + data shape, so a future breaking change to the contract can be introduced without breaking consumers still on version 1. */
  version: 1;
  data: TData;
};

// The Kafka payload for github.events. Everything GitHub-domain-specific
// is exactly NormalizedGitHubEvent (Stage B's existing output — never
// re-derived or duplicated here) plus two things Chat Service needs that
// normalization itself doesn't produce:
//
// - roomId: resolved by GitHub Service via the existing Room Service HTTP
//   lookup *before* publishing. Chat Service must never re-resolve
//   repository -> room itself; doing so would duplicate Room Service's
//   ownership of that mapping and reopen the door to repository-name-
//   based matching this architecture deliberately avoids.
//
// - content/metadata: the human-readable message text and structured
//   display metadata, rendered by GitHub Service's existing
//   eventContent.ts (renderEventContent/buildEventMetadata) — the exact
//   same rendering used by the pre-Kafka HTTP path. This intentionally
//   stays owned by GitHub Service rather than being duplicated as a
//   second switch-on-event-type implementation in Chat Service: a follow-
//   on to the "Kafka carries the normalized event, never a raw webhook
//   payload" requirement, since content/metadata ARE normalized data
//   (never GitHub's raw payload) and duplicating an 8-way switch across
//   two services is exactly the kind of drift risk this refactor should
//   not introduce. Chat Service's consumer only persists what it
//   receives; it does not re-derive rendering.
export type GithubEventData = NormalizedGitHubEvent & {
  roomId: string;
  content: string;
  metadata: Record<string, unknown>;
};

export type GithubEventMessage = EventEnvelope<GithubEventData>;

export function buildGithubEventEnvelope(
  event: NormalizedGitHubEvent,
  roomId: string,
  content: string,
  metadata: Record<string, unknown>,
): GithubEventMessage {
  return {
    eventId: event.id,
    eventType: event.type,
    source: "github-service",
    occurredAt: event.occurredAt,
    version: 1,
    data: { ...event, roomId, content, metadata },
  };
}
