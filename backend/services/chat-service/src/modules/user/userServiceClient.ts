import { internalConfig } from "../../config/internal";

export class UserServiceClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Confirms two users are friends via User Service's internal friendship
 * endpoint — the authoritative owner of the friend graph. Chat Service
 * never queries FriendRequest directly (same discipline as
 * roomServiceClient.ts not querying RoomMember directly), even though it
 * shares the same physical Postgres database.
 */
export async function areUsersFriends(userAId: string, userBId: string): Promise<boolean> {
  const response = await fetch(
    `${internalConfig.userServiceUrl}/internal/users/${encodeURIComponent(userAId)}/friends/${encodeURIComponent(userBId)}/status`,
    {
      headers: { "x-internal-service-secret": internalConfig.serviceSecret },
    },
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "User Service request failed";
    throw new UserServiceClientError(message, response.status);
  }

  return (data as { areFriends: boolean }).areFriends;
}
