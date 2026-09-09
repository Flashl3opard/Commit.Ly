import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { list, create, update, remove } from "./roomModule.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });
const roomAndModuleIdParamsSchema = z.object({
  roomId: z.string().uuid(),
  moduleId: z.string().uuid(),
});

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

function validateRoomAndModuleIdParams(req: Request, res: Response, next: NextFunction) {
  const parsed = roomAndModuleIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id or module id." });
  }
  return next();
}

// Mounted at /rooms/:roomId/modules
const router = Router({ mergeParams: true });

router.get("/", authMiddleware, validateRoomIdParam, list);
router.post("/", authMiddleware, validateRoomIdParam, create);
router.patch("/:moduleId", authMiddleware, validateRoomAndModuleIdParams, update);
router.delete("/:moduleId", authMiddleware, validateRoomAndModuleIdParams, remove);

export default router;
