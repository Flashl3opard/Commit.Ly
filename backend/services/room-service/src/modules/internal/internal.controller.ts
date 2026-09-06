import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";

/**
 * Minimum information another service (Chat Service) needs to authorize a
 * request against a room — never the full member list, never repository or
 * password data.
 */
export type InternalMembershipInfo = {
  role: "OWNER" | "MEMBER";
  joinedAt: string;
};

export async function getMembership(req: Request<{ roomId: string; userId: string }>, res: Response) {
  const { roomId, userId } = req.params;

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    return res.status(404).json({ error: "Not a member of this room" });
  }

  const info: InternalMembershipInfo = {
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
  };

  return res.status(200).json({ membership: info });
}

/**
 * Minimum information GitHub Service needs to route a webhook event to a
 * room — never the room name, password hash, or member list. Room.
 * githubRepositoryId is the current schema's unique constraint, so at most
 * one room can ever match a given GitHub repository.
 */
export type InternalRoomByRepositoryInfo = {
  roomId: string;
  githubRepositoryId: string;
};

export async function getRoomByGithubRepository(req: Request<{ githubRepositoryId: string }>, res: Response) {
  const { githubRepositoryId } = req.params;

  // githubRepositoryId in the URL is GitHub's own numeric repository id
  // (BigInt on GithubRepository), not Room.githubRepositoryId (which is an
  // internal UUID FK to GithubRepository.id) — so the lookup goes through
  // the githubRepository relation, never by repository name.
  let numericId: bigint;
  try {
    numericId = BigInt(githubRepositoryId);
  } catch {
    return res.status(400).json({ error: "Invalid GitHub repository id." });
  }

  const room = await prisma.room.findFirst({
    where: { githubRepository: { githubRepositoryId: numericId } },
    select: { id: true },
  });

  if (!room) {
    return res.status(404).json({ error: "No room found for this repository." });
  }

  const info: InternalRoomByRepositoryInfo = {
    roomId: room.id,
    githubRepositoryId,
  };

  return res.status(200).json({ room: info });
}
