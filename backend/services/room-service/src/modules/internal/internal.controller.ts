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
