import { internalConfig } from "../../config/internal";

export class RoomServiceClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type RoomMembership = {
  role: "OWNER" | "MEMBER";
  joinedAt: string;
};

/**
 * Looks up whether a user is a member of a room via Room Service's internal
 * API — Chat Service never queries RoomMember directly, even though it
 * shares the same physical Postgres database, to keep room membership as
 * Room Service's owned concern. Returns null if the user is not a member
 * (or the room doesn't exist); callers decide whether that means 403/404.
 */
export async function getRoomMembership(roomId: string, userId: string): Promise<RoomMembership | null> {
  const response = await fetch(
    `${internalConfig.roomServiceUrl}/internal/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`,
    {
      headers: { "x-internal-service-secret": internalConfig.serviceSecret },
    },
  );

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "Room Service request failed";
    throw new RoomServiceClientError(message, response.status);
  }

  return (data as { membership: RoomMembership }).membership;
}

export type ResolvedMentionMember = {
  userId: string;
  username: string;
};

/**
 * Resolves @mention candidate usernames against real current members of a
 * room via Room Service — the only source of truth for room membership.
 * Chat Service never trusts client-supplied user ids for mentions; it only
 * ever passes along usernames parsed from message text, and stores back
 * whatever subset Room Service confirms are actual members.
 */
export async function resolveMentionedMembers(
  roomId: string,
  usernames: string[],
): Promise<ResolvedMentionMember[]> {
  if (usernames.length === 0) return [];

  const response = await fetch(
    `${internalConfig.roomServiceUrl}/internal/rooms/${encodeURIComponent(roomId)}/members/resolve`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-secret": internalConfig.serviceSecret,
      },
      body: JSON.stringify({ usernames }),
    },
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "Room Service request failed";
    throw new RoomServiceClientError(message, response.status);
  }

  return (data as { members: ResolvedMentionMember[] }).members;
}
