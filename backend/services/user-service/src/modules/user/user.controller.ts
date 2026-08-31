import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { updateProfileSchema } from "./user.validation";
import { getPrivateUserById, updateUserProfile, getPublicProfileById } from "./user.service";

export async function getMe(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await getPrivateUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({ user });
}

export async function updateMe(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const user = await updateUserProfile(userId, parsed.data);
    return res.status(200).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
        return res.status(409).json({ error: `${target} already in use` });
      }
      if (err.code === "P2025") {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    throw err;
  }
}

export async function getUserProfile(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const user = await getPublicProfileById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(200).json({ user });
}
