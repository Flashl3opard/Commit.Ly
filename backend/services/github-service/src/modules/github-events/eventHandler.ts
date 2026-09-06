import type { NormalizedGitHubEvent } from "./normalizedEvent";
import { findRoomByGithubRepositoryId, RoomServiceClientError } from "./roomServiceClient";
import { createSystemMessage, ChatServiceClientError } from "./chatServiceClient";
import { renderEventContent, buildEventMetadata } from "./eventContent";

export type HandleEventResult =
  | { outcome: "no_room" }
  | { outcome: "delivered"; roomId: string }
  | { outcome: "downstream_failure"; roomId: string; error: Error };

/**
 * Stage C: takes an already-normalized GitHub event and drives it to a
 * Commit.ly room as a system message. This is the boundary between "GitHub
 * domain knowledge" (Stage A/B, upstream of this) and "Commit.ly domain
 * knowledge" (room lookup + system message) — this function itself still
 * knows nothing about raw GitHub webhook payloads, only the normalized
 * event shape.
 *
 * Does not create anything when no room is associated with the repository
 * — that's expected, routine behavior for most repositories, not a failure
 * to surface to the caller as anything other than "nothing to do".
 *
 * Downstream failures (Room Service or Chat Service unavailable) are
 * reported back rather than swallowed — the webhook controller uses this
 * to decide whether GitHub should retry the delivery.
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
    await createSystemMessage(roomId, { eventType: event.type, content, metadata });
  } catch (err) {
    if (err instanceof ChatServiceClientError) {
      return { outcome: "downstream_failure", roomId, error: err };
    }
    throw err;
  }

  return { outcome: "delivered", roomId };
}
