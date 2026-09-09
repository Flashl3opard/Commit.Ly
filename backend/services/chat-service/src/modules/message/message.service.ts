import { prisma } from "../../config/prisma";
import { getRoomMembership, getChannel, getDefaultChannel, RoomServiceClientError } from "../room/roomServiceClient";
import { encodeCursor, decodeCursor, InvalidCursorError } from "./cursor";
import { resolveMentions } from "./mentions";
import type { CreateMessageInput, EditMessageInput, ListMessagesQuery } from "./message.validation";
import type { CreateSystemMessageInput } from "./systemMessage.validation";

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
 *
 * userId is null only for senderType "system" (e.g. GitHub activity) —
 * there is no Commit.ly user to attribute those to. systemEventType and
 * metadata are present only on system messages and carry small, structured,
 * display-only data — never a raw external payload.
 */
export type SafeMessage = {
  id: string;
  roomId: string;
  channelId: string;
  userId: string | null;
  senderType: "user" | "system";
  systemEventType: string | null;
  metadata: Record<string, unknown> | null;
  content: string | null;
  parentMessageId: string | null;
  replyCount: number;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

type MessageRecord = {
  id: string;
  roomId: string;
  channelId: string;
  userId: string | null;
  senderType: "USER" | "SYSTEM";
  systemEventType: string | null;
  metadata: unknown;
  content: string;
  parentMessageId: string | null;
  replyCount: number;
  mentionedUserIds: string[];
  sequence: bigint;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

function toSafeMessage(message: {
  id: string;
  roomId: string;
  channelId: string;
  userId: string | null;
  senderType?: "USER" | "SYSTEM";
  systemEventType?: string | null;
  metadata?: unknown;
  content: string;
  parentMessageId?: string | null;
  replyCount?: number;
  mentionedUserIds?: string[];
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}): SafeMessage {
  return {
    id: message.id,
    roomId: message.roomId,
    channelId: message.channelId,
    userId: message.userId,
    senderType: message.senderType === "SYSTEM" ? "system" : "user",
    systemEventType: message.systemEventType ?? null,
    metadata: (message.metadata as Record<string, unknown> | null | undefined) ?? null,
    content: message.deletedAt ? null : message.content,
    parentMessageId: message.parentMessageId ?? null,
    replyCount: message.replyCount ?? 0,
    mentionedUserIds: message.deletedAt ? [] : (message.mentionedUserIds ?? []),
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

/**
 * Verifies channelId genuinely belongs to roomId and isn't archived, via
 * Room Service — the authoritative owner of channel structure. Never
 * trusts a roomId/channelId pairing supplied by the client without this
 * check, same discipline as assertRoomMembership.
 */
export async function assertChannelInRoom(roomId: string, channelId: string): Promise<void> {
  let channel;
  try {
    channel = await getChannel(roomId, channelId);
  } catch (err) {
    if (err instanceof RoomServiceClientError) {
      throw new MessageServiceError("Unable to verify channel access. Please try again.", 502);
    }
    throw err;
  }

  if (!channel) {
    throw new MessageServiceError("Channel not found.", 404);
  }
}

export async function createMessage(
  roomId: string,
  channelId: string,
  userId: string,
  input: CreateMessageInput,
): Promise<SafeMessage> {
  await assertRoomMembership(roomId, userId);
  await assertChannelInRoom(roomId, channelId);

  const mentionedUserIds = await resolveMentions(roomId, input.content);

  const message = await prisma.message.create({
    data: {
      roomId,
      channelId,
      userId,
      content: input.content,
      mentionedUserIds,
    },
  });

  return toSafeMessage(message);
}

/**
 * A reply is an ordinary Message with parentMessageId set — same table,
 * same send/edit/delete/broadcast/search machinery as a top-level message,
 * per the deliberate choice to not build a parallel messaging system. The
 * only extra step is denormalized replyCount maintenance on the parent.
 */
export type CreateReplyResult = {
  reply: SafeMessage;
  parent: SafeMessage;
};

/**
 * A reply is an ordinary Message with parentMessageId set — same table,
 * same send/edit/delete/broadcast/search machinery as a top-level message,
 * per the deliberate choice to not build a parallel messaging system. The
 * only extra step is denormalized replyCount maintenance on the parent.
 *
 * Returns both the new reply and the updated parent (with its bumped
 * replyCount) so the caller can broadcast both — clients that only have
 * the parent visible (thread panel closed) still need a live replyCount,
 * which only a broadcast of the parent itself can deliver.
 */
export async function createReply(
  roomId: string,
  parentMessageId: string,
  userId: string,
  input: CreateMessageInput,
): Promise<CreateReplyResult> {
  await assertRoomMembership(roomId, userId);

  const parent = await prisma.message.findUnique({ where: { id: parentMessageId } });
  if (!parent || parent.deletedAt || parent.roomId !== roomId) {
    throw new MessageServiceError("Thread not found.", 404);
  }
  if (parent.parentMessageId) {
    throw new MessageServiceError("Cannot reply to a reply — threads are one level deep.", 400);
  }

  const mentionedUserIds = await resolveMentions(roomId, input.content);

  const [reply, updatedParent] = await prisma.$transaction([
    prisma.message.create({
      data: {
        roomId,
        // A reply always lives in its parent's channel — there's no
        // separate concept of "which channel is this reply in," it's
        // implicitly wherever the thread it belongs to already is.
        channelId: parent.channelId,
        userId,
        content: input.content,
        parentMessageId,
        mentionedUserIds,
      },
    }),
    prisma.message.update({
      where: { id: parentMessageId },
      data: { replyCount: { increment: 1 } },
    }),
  ]);

  return { reply: toSafeMessage(reply), parent: toSafeMessage(updatedParent) };
}

export async function getThreadReplies(
  roomId: string,
  parentMessageId: string,
  userId: string,
): Promise<SafeMessage[]> {
  await assertRoomMembership(roomId, userId);

  const parent = await prisma.message.findUnique({ where: { id: parentMessageId } });
  if (!parent || parent.roomId !== roomId) {
    throw new MessageServiceError("Thread not found.", 404);
  }

  const records: MessageRecord[] = await prisma.message.findMany({
    where: { parentMessageId },
    orderBy: { sequence: "asc" },
  });

  return records.map(toSafeMessage);
}

/**
 * Persists a GitHub activity system message. Callers (the internal
 * system-messages endpoint) are responsible for authenticating the request
 * and validating the input shape before reaching here — this function does
 * not re-verify room membership, since the "room" here is addressed by
 * GitHub Service's own repository->room lookup, not a Commit.ly user
 * session. No user-facing membership check applies to a system actor.
 *
 * Never accepts or stores a userId — GitHub actors are never mapped to a
 * Commit.ly user, fake or otherwise.
 */
export async function createSystemMessage(
  roomId: string,
  input: CreateSystemMessageInput,
): Promise<SafeMessage> {
  // GitHub events have no channel of their own to target — a push/PR/issue
  // isn't "in" any channel a human picked — so they always land in the
  // room's general channel, the same place they'd have appeared before
  // channels existed. This preserves the existing GitHub webhook contract
  // unchanged: GitHub Service still only ever needs to know the roomId.
  let generalChannel;
  try {
    generalChannel = await getDefaultChannel(roomId);
  } catch (err) {
    if (err instanceof RoomServiceClientError) {
      throw new MessageServiceError("Unable to resolve the room's default channel. Please try again.", 502);
    }
    throw err;
  }

  if (!generalChannel) {
    throw new MessageServiceError("Room not found.", 404);
  }

  const message = await prisma.message.create({
    data: {
      roomId,
      channelId: generalChannel.id,
      userId: null,
      senderType: "SYSTEM",
      systemEventType: input.eventType,
      metadata: input.metadata,
      content: input.content,
    },
  });

  return toSafeMessage(message);
}

const SEARCH_RESULT_LIMIT = 25;

export async function searchMessages(roomId: string, userId: string, query: string): Promise<SafeMessage[]> {
  await assertRoomMembership(roomId, userId);

  const records: MessageRecord[] = await prisma.message.findMany({
    where: {
      roomId,
      deletedAt: null,
      content: { contains: query, mode: "insensitive" },
    },
    orderBy: { sequence: "desc" },
    take: SEARCH_RESULT_LIMIT,
  });

  return records.map(toSafeMessage);
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
  channelId: string,
  userId: string,
  query: ListMessagesQuery,
): Promise<MessageHistoryPage> {
  await assertRoomMembership(roomId, userId);
  await assertChannelInRoom(roomId, channelId);

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
  // separate count query. parentMessageId: null excludes replies — they
  // belong only to their thread's own reply list (GET .../replies), never
  // the main room history, regardless of how far back pagination goes.
  const records: MessageRecord[] = await prisma.message.findMany({
    where: {
      roomId,
      channelId,
      parentMessageId: null,
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

/**
 * Loads a message and verifies both room membership and message authorship.
 * Being a room member is never sufficient on its own to edit/delete another
 * member's message — only the original author may. A message that has
 * already been soft-deleted is treated as not-editable/not-deletable
 * (404), since its content is already gone and re-exposing its existence
 * for further mutation serves no purpose.
 */
async function loadOwnedMessage(messageId: string, userId: string): Promise<MessageRecord> {
  const message: MessageRecord | null = await prisma.message.findUnique({ where: { id: messageId } });

  if (!message || message.deletedAt) {
    throw new MessageServiceError("Message not found.", 404);
  }

  await assertRoomMembership(message.roomId, userId);

  if (message.userId !== userId) {
    throw new MessageServiceError("You can only modify your own messages.", 403);
  }

  return message;
}

export async function editMessage(
  messageId: string,
  userId: string,
  input: EditMessageInput,
): Promise<SafeMessage> {
  const existing = await loadOwnedMessage(messageId, userId);

  // Mentions are preserved by re-resolving from the edited text rather than
  // carrying over the original list — an edit that removes an @mention
  // should drop it, and one that adds a new one should pick it up, exactly
  // like a fresh send.
  const mentionedUserIds = await resolveMentions(existing.roomId, input.content);

  const now = new Date();
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: input.content, editedAt: now, mentionedUserIds },
  });

  return toSafeMessage(updated);
}

export type DeleteMessageResult = {
  deleted: SafeMessage;
  /** Present only when the deleted message was a reply — the caller should broadcast this too, same reasoning as CreateReplyResult.parent. */
  updatedParent: SafeMessage | null;
};

export async function deleteMessage(messageId: string, userId: string): Promise<DeleteMessageResult> {
  const existing = await loadOwnedMessage(messageId, userId);

  const now = new Date();

  // Only replies touch a second row (the parent's replyCount), so only
  // replies pay for a transaction — the much more common top-level delete
  // stays a single update, unchanged from before threads existed.
  if (existing.parentMessageId) {
    const [deleted, updatedParent] = await prisma.$transaction([
      prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: now },
      }),
      prisma.message.update({
        where: { id: existing.parentMessageId },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
    return { deleted: toSafeMessage(deleted), updatedParent: toSafeMessage(updatedParent) };
  }

  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: now },
  });

  return { deleted: toSafeMessage(deleted), updatedParent: null };
}
