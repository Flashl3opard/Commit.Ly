import type { Request, Response } from "express";
import { createChannelSchema, updateChannelSchema } from "./channel.validation";
import { listChannels, createChannel, updateChannel, archiveChannel } from "./channel.service";
import { RoomServiceError } from "../room/room.service";

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof RoomServiceError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

export async function list(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const channels = await listChannels(userId, req.params.roomId);
    return res.status(200).json({ channels });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function create(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const channel = await createChannel(userId, req.params.roomId, parsed.data);
    return res.status(201).json({ channel });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function update(req: Request<{ roomId: string; channelId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = updateChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const channel = await updateChannel(userId, req.params.roomId, req.params.channelId, parsed.data);
    return res.status(200).json({ channel });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function remove(req: Request<{ roomId: string; channelId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const channel = await archiveChannel(userId, req.params.roomId, req.params.channelId);
    return res.status(200).json({ channel });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
