import { getRoomMembership, RoomServiceClientError } from "../room/roomServiceClient";

export class MessageServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the authenticated user is currently a member of the room via
 * Room Service — the authoritative source for membership. Never trusts a
 * roomId/userId pairing supplied without this check; the userId here must
 * always come from the verified JWT, never from client input.
 */
export async function assertRoomMembership(roomId: string, userId: string): Promise<void> {
  let membership;
  try {
    membership = await getRoomMembership(roomId, userId);
  } catch (err) {
    if (err instanceof RoomServiceClientError) {
      throw new MessageServiceError("Unable to verify room access. Please try again.", 502);
    }
    throw err;
  }

  if (!membership) {
    throw new MessageServiceError("You do not have access to this room.", 403);
  }
}
