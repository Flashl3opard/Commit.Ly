import type { Request, Response } from "express";
import {
  searchUsersQuerySchema,
  sendFriendRequestSchema,
  respondToFriendRequestSchema,
} from "./friend.validation";
import {
  searchUsersByUsername,
  sendFriendRequest,
  respondToFriendRequest,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  listFriends,
  removeFriend,
  FriendServiceError,
} from "./friend.service";

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof FriendServiceError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

export async function searchUsers(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = searchUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid search query", details: parsed.error.flatten() });
  }

  const users = await searchUsersByUsername(userId, parsed.data.username);
  return res.status(200).json({ users });
}

export async function createFriendRequest(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = sendFriendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const request = await sendFriendRequest(userId, parsed.data.username);
    return res.status(201).json({ request });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function respondToRequest(req: Request<{ requestId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = respondToFriendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const request = await respondToFriendRequest(req.params.requestId, userId, parsed.data.action);
    return res.status(200).json({ request });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function listRequests(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [incoming, outgoing] = await Promise.all([
    listIncomingFriendRequests(userId),
    listOutgoingFriendRequests(userId),
  ]);

  return res.status(200).json({ incoming, outgoing });
}

export async function listMyFriends(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const friends = await listFriends(userId);
  return res.status(200).json({ friends });
}

export async function deleteFriend(req: Request<{ userId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await removeFriend(userId, req.params.userId);
    return res.status(204).send();
  } catch (err) {
    return handleServiceError(err, res);
  }
}
