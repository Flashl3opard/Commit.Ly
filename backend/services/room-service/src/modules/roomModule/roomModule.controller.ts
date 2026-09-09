import type { Request, Response } from "express";
import { createRoomModuleSchema, updateRoomModuleSchema } from "./roomModule.validation";
import { listRoomModules, createRoomModule, updateRoomModule, removeRoomModule } from "./roomModule.service";
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
    const modules = await listRoomModules(userId, req.params.roomId);
    return res.status(200).json({ modules });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function create(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createRoomModuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const module_ = await createRoomModule(userId, req.params.roomId, parsed.data);
    return res.status(201).json({ module: module_ });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function update(req: Request<{ roomId: string; moduleId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = updateRoomModuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const module_ = await updateRoomModule(userId, req.params.roomId, req.params.moduleId, parsed.data);
    return res.status(200).json({ module: module_ });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function remove(req: Request<{ roomId: string; moduleId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    await removeRoomModule(userId, req.params.roomId, req.params.moduleId);
    return res.status(200).json({ message: "Module removed." });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
