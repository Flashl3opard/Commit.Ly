import { prisma } from "../../config/prisma";
import { getRoomMembership, RoomServiceClientError } from "../room/roomServiceClient";
import { encodeCursor, decodeCursor, InvalidCursorError } from "./cursor";
import type { CreateMessageInput, ListMessagesQuery } from "./message.validation";

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

type MessageRecord = {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  sequence: bigint;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
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

export type MessageHistoryPage = {
  messages: SafeMessage[];
  nextCursor: string | null;
};

/**
 * Cursor pagination, newest-first internally but returned oldest -> newest
 * within the page (a UI-friendly order — the caller can append the page
 * directly above/below existing messages without re-sorting).
 *
 * `before` (if given) means "messages strictly older than this cursor" —
 * so repeatedly following `nextCursor` walks backward through history,
 * page by page, toward the room's oldest message. Ordering is by the
 * monotonic `sequence` column, not `createdAt`, so it stays deterministic
 * even when timestamps collide.
 */
export async function getMessageHistory(
  roomId: string,
  userId: string,
  query: ListMessagesQuery,
): Promise<MessageHistoryPage> {
  await assertRoomMembership(roomId, userId);

  let beforeSequence: bigint | undefined;
  if (query.before !== undefined) {
    try {
      beforeSequence = decodeCursor(query.before);
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw new MessageServiceError("Invalid pagination cursor.", 400);
      }
      throw err;
    }
  }

  // Fetch limit+1 so we can tell whether there is a next page without a
  // separate count query.
  const records: MessageRecord[] = await prisma.message.findMany({
    where: {
      roomId,
      ...(beforeSequence !== undefined ? { sequence: { lt: beforeSequence } } : {}),
    },
    orderBy: { sequence: "desc" },
    take: query.limit + 1,
  });

  const hasMore = records.length > query.limit;
  const page = records.slice(0, query.limit);
  const oldestInPage = page[page.length - 1];

  return {
    messages: page.map(toSafeMessage).reverse(),
    nextCursor: hasMore && oldestInPage ? encodeCursor(oldestInPage.sequence) : null,
  };
}
