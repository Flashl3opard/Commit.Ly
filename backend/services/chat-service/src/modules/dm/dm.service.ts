import { prisma } from "../../config/prisma";
import { areUsersFriends, UserServiceClientError } from "../user/userServiceClient";
import { encodeCursor, decodeCursor, InvalidCursorError } from "../message/cursor";
import type { CreateDmMessageInput, EditDmMessageInput, ListDmMessagesQuery } from "./dm.validation";

export class DmServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SafeDmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

type DmMessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sequence: bigint;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

function toSafeDmMessage(message: DmMessageRecord): SafeDmMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.deletedAt ? null : message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  };
}

export type SafeDmConversation = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
  updatedAt: string;
};

function toSafeConversation(conversation: {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: Date;
  updatedAt: Date;
}): SafeDmConversation {
  return {
    id: conversation.id,
    userAId: conversation.userAId,
    userBId: conversation.userBId,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/** Canonical ordering for a conversation's two participants — see DmConversation's doc comment in schema.prisma. */
function orderPair(userId: string, otherUserId: string): [string, string] {
  return userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
}

/**
 * Verifies the two users are friends via User Service — the authoritative
 * owner of the friend graph. Never trusts a client-supplied conversation
 * partner without this check; a DM can only ever be opened between
 * friends, matching the product requirement that DMs are a friends-only
 * feature.
 */
async function assertFriends(userId: string, otherUserId: string): Promise<void> {
  let areFriends: boolean;
  try {
    areFriends = await areUsersFriends(userId, otherUserId);
  } catch (err) {
    if (err instanceof UserServiceClientError) {
      throw new DmServiceError("Unable to verify friendship. Please try again.", 502);
    }
    throw err;
  }

  if (!areFriends) {
    throw new DmServiceError("You can only message friends.", 403);
  }
}

/**
 * Verifies the requesting user is a genuine participant of the
 * conversation. Never trusts a conversationId supplied by the client
 * without this check.
 */
async function loadOwnedConversation(conversationId: string, userId: string) {
  const conversation = await prisma.dmConversation.findUnique({ where: { id: conversationId } });

  if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
    throw new DmServiceError("Conversation not found.", 404);
  }

  return conversation;
}

/**
 * Gets or creates the single conversation between the current user and
 * otherUserId. Both users must already be friends. Idempotent: calling
 * this repeatedly for the same pair always returns the same row, thanks
 * to the canonical-ordering unique constraint.
 */
export async function getOrCreateConversation(userId: string, otherUserId: string): Promise<SafeDmConversation> {
  if (userId === otherUserId) {
    throw new DmServiceError("You cannot start a conversation with yourself.", 400);
  }

  await assertFriends(userId, otherUserId);

  const [userAId, userBId] = orderPair(userId, otherUserId);

  const conversation = await prisma.dmConversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  return toSafeConversation(conversation);
}

export type ConversationSummary = SafeDmConversation & {
  otherUserId: string;
  lastMessage: SafeDmMessage | null;
};

/**
 * Lists every conversation the user participates in, newest-activity
 * first, each with its last message for a preview — the shape a
 * conversation-list UI needs in one call rather than N+1 requests.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const conversations = await prisma.dmConversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { sequence: "desc" },
        take: 1,
      },
    },
  });

  return conversations.map((conversation) => ({
    ...toSafeConversation(conversation),
    otherUserId: conversation.userAId === userId ? conversation.userBId : conversation.userAId,
    lastMessage: conversation.messages[0] ? toSafeDmMessage(conversation.messages[0]) : null,
  }));
}

export async function createDmMessage(
  conversationId: string,
  userId: string,
  input: CreateDmMessageInput,
): Promise<SafeDmMessage> {
  const conversation = await loadOwnedConversation(conversationId, userId);
  const otherUserId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;

  // Re-verified on every send, not just at conversation-creation time — an
  // unfriend must immediately stop further messages in an existing
  // conversation, matching the product requirement that DMs are
  // friends-only at all times, not just at first contact.
  await assertFriends(userId, otherUserId);

  const [message] = await prisma.$transaction([
    prisma.dmMessage.create({
      data: { conversationId, senderId: userId, content: input.content },
    }),
    prisma.dmConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  return toSafeDmMessage(message);
}

export type DmMessageHistoryPage = {
  messages: SafeDmMessage[];
  nextCursor: string | null;
};

export async function getDmMessageHistory(
  conversationId: string,
  userId: string,
  query: ListDmMessagesQuery,
): Promise<DmMessageHistoryPage> {
  await loadOwnedConversation(conversationId, userId);

  let beforeSequence: bigint | undefined;
  if (query.before !== undefined) {
    try {
      beforeSequence = decodeCursor(query.before);
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw new DmServiceError("Invalid pagination cursor.", 400);
      }
      throw err;
    }
  }

  const records: DmMessageRecord[] = await prisma.dmMessage.findMany({
    where: {
      conversationId,
      ...(beforeSequence !== undefined ? { sequence: { lt: beforeSequence } } : {}),
    },
    orderBy: { sequence: "desc" },
    take: query.limit + 1,
  });

  const hasMore = records.length > query.limit;
  const page = records.slice(0, query.limit);
  const oldestInPage = page[page.length - 1];

  return {
    messages: page.map(toSafeDmMessage).reverse(),
    nextCursor: hasMore && oldestInPage ? encodeCursor(oldestInPage.sequence) : null,
  };
}

async function loadOwnedMessage(messageId: string, userId: string): Promise<DmMessageRecord> {
  const message: DmMessageRecord | null = await prisma.dmMessage.findUnique({ where: { id: messageId } });

  if (!message || message.deletedAt) {
    throw new DmServiceError("Message not found.", 404);
  }

  await loadOwnedConversation(message.conversationId, userId);

  if (message.senderId !== userId) {
    throw new DmServiceError("You can only modify your own messages.", 403);
  }

  return message;
}

export async function editDmMessage(messageId: string, userId: string, input: EditDmMessageInput): Promise<SafeDmMessage> {
  const existing = await loadOwnedMessage(messageId, userId);

  const updated = await prisma.dmMessage.update({
    where: { id: existing.id },
    data: { content: input.content, editedAt: new Date() },
  });

  return toSafeDmMessage(updated);
}

export async function deleteDmMessage(messageId: string, userId: string): Promise<SafeDmMessage> {
  const existing = await loadOwnedMessage(messageId, userId);

  const deleted = await prisma.dmMessage.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  return toSafeDmMessage(deleted);
}

/** Used by the WS layer to authorize a socket joining a conversation. */
export async function assertConversationParticipant(conversationId: string, userId: string): Promise<SafeDmConversation> {
  const conversation = await loadOwnedConversation(conversationId, userId);
  return toSafeConversation(conversation);
}
