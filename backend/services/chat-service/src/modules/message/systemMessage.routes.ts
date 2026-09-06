import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { createSystemMessageHandler } from "./systemMessage.controller";
import { internalServiceMiddleware } from "../../middleware/internalServiceMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

const router = Router();

router.use(internalServiceMiddleware);

router.post("/rooms/:roomId/system-messages", validateRoomIdParam, createSystemMessageHandler);

export default router;
