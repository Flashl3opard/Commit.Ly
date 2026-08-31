import { Router } from "express";
import { getMe, updateMe, getUserProfile } from "./user.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);
router.get("/:id", getUserProfile);

export default router;
