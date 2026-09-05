import type { Request, Response } from "express";
import { createRoomSchema, joinRoomSchema } from "./room.validation";
import {
  createRoom,
  joinRoom,
  getRoomsForUser,
  getRoomDetails,
  leaveRoom,
  deleteRoom,
  RoomServiceError,
} from "./room.service";

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof RoomServiceError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

export async function create(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const room = await createRoom(userId, parsed.data);
    return res.status(201).json({ room });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function join(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = joinRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const room = await joinRoom(userId, parsed.data);
    return res.status(200).json({ room });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function listMine(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const rooms = await getRoomsForUser(userId);
  return res.status(200).json({ rooms });
}

export async function getDetails(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const room = await getRoomDetails(userId, req.params.roomId);
    return res.status(200).json({ room });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function leave(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    await leaveRoom(userId, req.params.roomId);
    return res.status(200).json({ message: "Left room." });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function remove(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    await deleteRoom(userId, req.params.roomId);
    return res.status(200).json({ message: "Room deleted." });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
