import type { NormalizedGitHubEvent } from "./normalizedEvent";
import { findRoomByGithubRepositoryId, RoomServiceClientError } from "./roomServiceClient";
import { publishGithubEvent, KafkaPublishError } from "../kafka/kafka.producer";
import { renderEventContent, buildEventMetadata } from "./eventContent";

export type HandleEventResult =
  | { outcome: "no_room" }
  | { outcome: "delivered"; roomId: string }
  | { outcome: "downstream_failure"; roomId: string; error: Error };

/**
 * Stage C: takes an already-normalized GitHub event and drives it to a
 * Commit.ly room. This is the boundary between "GitHub domain knowledge"
 * (Stage A/B, upstream of this) and "Commit.ly domain knowledge" (room
 * lookup + event publish) — this function itself still knows nothing
 * about raw GitHub webhook payloads, only the normalized event shape.
 *
 * Room resolution stays an HTTP call to Room Service (an "I need an
 * answer" query — see kafka.producer.ts's key-choice comment) — only the
 * delivery of the normalized event to Chat Service moved to Kafka
 * ("something happened"). GitHub Service still owns resolving
 * repository -> room; Chat Service never re-derives it, which would
 * reopen the door to name-based repository matching this architecture
 * deliberately avoids.
 *
 * Does not create anything when no room is associated with the repository
 * — that's expected, routine behavior for most repositories, not a failure
 * to surface to the caller as anything other than "nothing to do".
 *
 * Downstream failures (Room Service HTTP unavailable, or the Kafka publish
 * itself failing) are reported back rather than swallowed — the webhook
 * controller uses this to decide whether GitHub should retry the
 * delivery. A publish failure here means the broker never accepted the
 * message (see KafkaPublishError's contract in kafka.producer.ts) — it is
 * never treated as delivered just because normalization/room-lookup
 * succeeded.
 */
export async function handleNormalizedGitHubEvent(event: NormalizedGitHubEvent): Promise<HandleEventResult> {
  let roomId: string | null;
  try {
    roomId = await findRoomByGithubRepositoryId(event.repository.githubRepositoryId);
  } catch (err) {
    if (err instanceof RoomServiceClientError) {
      return { outcome: "downstream_failure", roomId: "", error: err };
    }
    throw err;
  }

  if (!roomId) {
    return { outcome: "no_room" };
  }

  const content = renderEventContent(event);
  const metadata = buildEventMetadata(event);

  try {
    await publishGithubEvent(event, roomId, content, metadata);
  } catch (err) {
    if (err instanceof KafkaPublishError) {
      return { outcome: "downstream_failure", roomId, error: err };
    }
    throw err;
  }

  return { outcome: "delivered", roomId };
}
