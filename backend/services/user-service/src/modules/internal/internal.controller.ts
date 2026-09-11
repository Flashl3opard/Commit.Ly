import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { linkGithubSchema } from "./internal.validation";
import { linkGithubIdentity, unlinkGithubIdentity, getGithubIdentityState } from "../user/user.service";
import { areUsersFriends } from "../friend/friend.service";

export async function linkGithub(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const parsed = linkGithubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const user = await linkGithubIdentity(id, parsed.data.githubId, parsed.data.githubUsername);
    return res.status(200).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "This GitHub account is already linked to another user." });
      }
      if (err.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
    }
    throw err;
  }
}

export async function unlinkGithub(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  try {
    const user = await unlinkGithubIdentity(id);
    return res.status(200).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    throw err;
  }
}

export async function getGithubIdentity(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const identity = await getGithubIdentityState(id);
  if (!identity) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json({ identity });
}

/**
 * Confirms two users are friends, for Chat Service to check before
 * allowing a DM conversation or message between them. Never exposes any
 * other friend-graph detail (request ids, timestamps) — a boolean is all
 * a cross-service authorization check needs.
 */
export async function getFriendshipStatus(req: Request<{ userAId: string; userBId: string }>, res: Response) {
  const { userAId, userBId } = req.params;

  const areFriends = await areUsersFriends(userAId, userBId);
  return res.status(200).json({ areFriends });
}
