import { Router } from "express";
import { install, callback, status, repositories } from "./githubApp.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/install", authMiddleware, install);
router.get("/callback", callback);
router.get("/status", authMiddleware, status);
router.get("/repositories", authMiddleware, repositories);

export default router;
