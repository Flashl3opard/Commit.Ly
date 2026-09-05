import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { create, join, listMine, getDetails, leave, remove } from "./room.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

const router = Router();

router.post("/", authMiddleware, create);
router.post("/join", authMiddleware, join);
router.get("/", authMiddleware, listMine);
router.get("/:roomId", authMiddleware, validateRoomIdParam, getDetails);
router.post("/:roomId/leave", authMiddleware, validateRoomIdParam, leave);
router.delete("/:roomId", authMiddleware, validateRoomIdParam, remove);

export default router;
