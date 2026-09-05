import { prisma } from "../../config/prisma";
import { getRoomMembership, RoomServiceClientError } from "../room/roomServiceClient";
import type { CreateMessageInput } from "./message.validation";

export class MessageServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Safe wire representation of a message. content is null once the message
 * has been soft-deleted — the tombstone still carries id/roomId/userId/
 * timestamps so future realtime/sync consumers can react to the deletion,
 * but the original text is never returned again through any API.
 */
export type SafeMessage = {
  id: string;
  roomId: string;
  userId: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

function toSafeMessage(message: {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}): SafeMessage {
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    content: message.deletedAt ? null : message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  };
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

export async function createMessage(
  roomId: string,
  userId: string,
  input: CreateMessageInput,
): Promise<SafeMessage> {
  await assertRoomMembership(roomId, userId);

  const message = await prisma.message.create({
    data: {
      roomId,
      userId,
      content: input.content,
    },
  });

  return toSafeMessage(message);
}
