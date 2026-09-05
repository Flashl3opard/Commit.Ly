import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { edit, remove } from "./message.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const messageIdParamSchema = z.object({ messageId: z.string().uuid() });

function validateMessageIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = messageIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message id." });
  }
  return next();
}

// Mounted at /messages/:messageId
const messageByIdRouter = Router({ mergeParams: true });
messageByIdRouter.patch("/", authMiddleware, validateMessageIdParam, edit);
messageByIdRouter.delete("/", authMiddleware, validateMessageIdParam, remove);

export { messageByIdRouter };
