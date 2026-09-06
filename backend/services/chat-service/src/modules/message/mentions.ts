import { resolveMentionedMembers, RoomServiceClientError } from "../room/roomServiceClient";

// Matches @handle tokens: @ followed by 1-32 word/dot/dash characters,
// mirroring the username character set enforced at signup (letters,
// digits, underscore, dot, dash). Doesn't require word boundaries beyond
// what \b + the character class already give us, so "email@domain.com"
// only matches "@domain" as a candidate — which then simply fails to
// resolve against real room members and is dropped, per resolveMentions'
// contract of silently ignoring non-matches.
const MENTION_PATTERN = /@([a-zA-Z0-9_.-]{1,32})/g;

export function extractMentionCandidates(content: string): string[] {
  const matches = content.matchAll(MENTION_PATTERN);
  const usernames = new Set<string>();
  for (const match of matches) {
    usernames.add(match[1]);
  }
  return [...usernames];
}

/**
 * Parses @handle candidates out of message content and resolves them
 * against real current room membership. Never trusts client input beyond
 * the raw text — the returned user ids are exactly the subset Room Service
 * confirmed are actual members of this room right now.
 */
export async function resolveMentions(roomId: string, content: string): Promise<string[]> {
  const candidates = extractMentionCandidates(content);
  if (candidates.length === 0) return [];

  try {
    const resolved = await resolveMentionedMembers(roomId, candidates);
    return resolved.map((m) => m.userId);
  } catch (err) {
    if (err instanceof RoomServiceClientError) {
      // Mentions are an enhancement, not a delivery guarantee — if Room
      // Service is unreachable, the message still sends, just without
      // resolved mentions, rather than failing the whole send.
      return [];
    }
    throw err;
  }
}
