import { ApiError } from "./types";

export type ErrorStateCopy = { title: string; description: string };

/**
 * Maps a caught error to the title/description an ErrorState should show.
 * status 0 means the fetch itself never completed (offline, DNS failure,
 * the service isn't listening at all) — genuinely different from a
 * service that responded but with a non-2xx status, and worth telling the
 * user apart since one is "check your connection" and the other is
 * "something's wrong on our end."
 */
export function errorStateCopyFor(err: unknown, fallbackDescription: string): ErrorStateCopy {
  if (err instanceof ApiError && err.status === 0) {
    return { title: "Network error", description: "Couldn't reach Commit.ly. Check your connection and try again." };
  }
  if (err instanceof ApiError) {
    return { title: "Couldn't connect to Commit.ly", description: err.message };
  }
  return { title: "Couldn't connect to Commit.ly", description: fallbackDescription };
}
