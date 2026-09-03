import { Router } from "express";
import { connect, callback, status, disconnect } from "./github.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/connect", authMiddleware, connect);
router.get("/callback", callback);
router.get("/status", authMiddleware, status);
router.delete("/disconnect", authMiddleware, disconnect);

export default router;
