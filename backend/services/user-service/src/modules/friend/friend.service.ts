import { prisma } from "../../config/prisma";

export class FriendServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SEARCH_RESULT_LIMIT = 10;

export type UserSearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Prefix match on username, case-insensitive, excluding the searching user
 * themselves — this is the only username-search entry point in the
 * codebase today. Deliberately narrow result shape (no bio/email/etc.),
 * same discipline as PublicProfile.
 */
export async function searchUsersByUsername(currentUserId: string, prefix: string): Promise<UserSearchResult[]> {
  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: prefix, mode: "insensitive" },
      id: { not: currentUserId },
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
    take: SEARCH_RESULT_LIMIT,
    orderBy: { username: "asc" },
  });

  return users;
}

export type FriendRequestSummary = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  otherUser: UserSearchResult;
};

function toSummary(
  request: {
    id: string;
    senderId: string;
    receiverId: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    createdAt: Date;
  },
  otherUser: UserSearchResult,
): FriendRequestSummary {
  return {
    id: request.id,
    senderId: request.senderId,
    receiverId: request.receiverId,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    otherUser,
  };
}

/**
 * Sends a friend request by username. Reuses whatever row already exists
 * between the two users instead of creating a duplicate — a prior REJECTED
 * request is revived back to PENDING (with the sender/receiver possibly
 * swapped from the original), and an existing PENDING/ACCEPTED request is
 * left alone and reported as a conflict, since re-sending either would be
 * meaningless.
 */
export async function sendFriendRequest(senderId: string, receiverUsername: string): Promise<FriendRequestSummary> {
  const receiver = await prisma.user.findUnique({
    where: { username: receiverUsername },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });

  if (!receiver) {
    throw new FriendServiceError("User not found.", 404);
  }

  if (receiver.id === senderId) {
    throw new FriendServiceError("You cannot send a friend request to yourself.", 400);
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId, receiverId: receiver.id },
        { senderId: receiver.id, receiverId: senderId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "PENDING") {
      throw new FriendServiceError("A friend request is already pending with this user.", 409);
    }
    if (existing.status === "ACCEPTED") {
      throw new FriendServiceError("You are already friends with this user.", 409);
    }

    // Previously REJECTED — revive it as a fresh request from the current
    // sender, since the unique constraint is on the ordered pair and the
    // rejection may have been recorded in either direction.
    const revived = await prisma.friendRequest.update({
      where: { id: existing.id },
      data: { senderId, receiverId: receiver.id, status: "PENDING" },
    });

    return toSummary(revived, receiver);
  }

  const created = await prisma.friendRequest.create({
    data: { senderId, receiverId: receiver.id },
  });

  return toSummary(created, receiver);
}

async function loadUserSearchResult(userId: string): Promise<UserSearchResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  return user;
}

/**
 * Accepts or rejects an incoming request. Only the receiver may respond —
 * the sender cannot accept/reject their own outgoing request.
 */
export async function respondToFriendRequest(
  requestId: string,
  userId: string,
  action: "accept" | "reject",
): Promise<FriendRequestSummary> {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new FriendServiceError("Friend request not found.", 404);
  }

  if (request.receiverId !== userId) {
    throw new FriendServiceError("You do not have access to this friend request.", 403);
  }

  if (request.status !== "PENDING") {
    throw new FriendServiceError("This friend request has already been responded to.", 409);
  }

  const updated = await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
  });

  const otherUser = await loadUserSearchResult(request.senderId);
  return toSummary(updated, otherUser);
}

export async function listIncomingFriendRequests(userId: string): Promise<FriendRequestSummary[]> {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const results: FriendRequestSummary[] = [];
  for (const request of requests) {
    const otherUser = await loadUserSearchResult(request.senderId);
    results.push(toSummary(request, otherUser));
  }
  return results;
}

export async function listOutgoingFriendRequests(userId: string): Promise<FriendRequestSummary[]> {
  const requests = await prisma.friendRequest.findMany({
    where: { senderId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const results: FriendRequestSummary[] = [];
  for (const request of requests) {
    const otherUser = await loadUserSearchResult(request.receiverId);
    results.push(toSummary(request, otherUser));
  }
  return results;
}

export type FriendSummary = UserSearchResult & { friendsSince: string };

export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const accepted = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    orderBy: { updatedAt: "desc" },
  });

  const results: FriendSummary[] = [];
  for (const request of accepted) {
    const otherUserId = request.senderId === userId ? request.receiverId : request.senderId;
    const otherUser = await loadUserSearchResult(otherUserId);
    results.push({ ...otherUser, friendsSince: request.updatedAt.toISOString() });
  }
  return results;
}

/**
 * Removes an existing friendship (either party may unfriend the other).
 * Deletes the row outright rather than leaving a REJECTED tombstone —
 * unfriending is not the same lifecycle event as rejecting a request, and
 * either former friend should be able to send a fresh request afterward
 * without it looking like a revival of the old one.
 */
export async function removeFriend(userId: string, otherUserId: string): Promise<void> {
  const existing = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
  });

  if (!existing) {
    throw new FriendServiceError("You are not friends with this user.", 404);
  }

  await prisma.friendRequest.delete({ where: { id: existing.id } });
}

/**
 * Internal-only: are these two users friends? Used by Chat Service before
 * allowing a DM conversation/message between them. Order-independent.
 */
export async function areUsersFriends(userAId: string, userBId: string): Promise<boolean> {
  const existing = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userAId, receiverId: userBId },
        { senderId: userBId, receiverId: userAId },
      ],
    },
    select: { id: true },
  });

  return existing !== null;
}
