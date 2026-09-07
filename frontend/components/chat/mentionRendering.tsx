import type { ReactNode } from "react";
import type { RoomMember } from "@/lib/api/rooms";

// Mirrors the backend's mention-candidate pattern (chat-service's
// mentions.ts) so the frontend highlights exactly the substrings the
// server would have considered as mention candidates. Only tokens that
// also match an actual resolved member (mentionedUserIds) render as a
// mention — an unresolved "@typo" stays plain text, since the message's
// mentionedUserIds is the one source of truth for who was really mentioned.
const MENTION_TOKEN_PATTERN = /@([a-zA-Z0-9_.-]{1,32})/g;

/**
 * Splits message content into plain-text and mention segments. A token
 * renders as a mention only when its handle matches a member whose userId
 * is present in mentionedUserIds — this is what prevents "@typo" or
 * "user@example.com" from ever rendering as a highlighted mention even
 * though they match the token shape.
 */
export function renderMessageContent(content: string, mentionedUserIds: string[], members: RoomMember[]): ReactNode[] {
  if (mentionedUserIds.length === 0) return [content];

  const mentionedMembers = new Map(
    members.filter((m) => mentionedUserIds.includes(m.userId)).map((m) => [m.username?.toLowerCase(), m]),
  );
  if (mentionedMembers.size === 0) return [content];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(MENTION_TOKEN_PATTERN)) {
    const handle = match[1];
    const member = mentionedMembers.get(handle.toLowerCase());
    if (!member) continue;

    const start = match.index;
    if (start > lastIndex) nodes.push(content.slice(lastIndex, start));

    nodes.push(
      <span
        key={`mention-${key++}`}
        className="rounded bg-accent-soft px-1 py-0.5 font-medium text-accent"
      >
        @{member.displayName ?? member.username}
      </span>,
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes.length > 0 ? nodes : [content];
}
