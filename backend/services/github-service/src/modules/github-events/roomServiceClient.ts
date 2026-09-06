import { internalConfig } from "../../config/internal";

export class RoomServiceClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Looks up the Commit.ly room associated with a GitHub repository, by
 * GitHub's numeric repository id, via Room Service's internal API. Never
 * queries Room Service's database directly and never imports its Prisma
 * models — Room ownership of this data stays behind the HTTP boundary.
 *
 * Returns null when no room exists for the repository — this is expected,
 * routine behavior (most repositories never get a Commit.ly room), not an
 * error condition.
 */
export async function findRoomByGithubRepositoryId(githubRepositoryId: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${internalConfig.roomServiceUrl}/internal/rooms/by-github-repository/${encodeURIComponent(githubRepositoryId)}`,
      {
        headers: { "x-internal-service-secret": internalConfig.serviceSecret },
        signal: controller.signal,
      },
    );
  } catch (err) {
    throw new RoomServiceClientError("Room Service request failed", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new RoomServiceClientError("Room Service request failed", response.status);
  }

  const data = (await response.json()) as { room: { roomId: string } };
  return data.room.roomId;
}
