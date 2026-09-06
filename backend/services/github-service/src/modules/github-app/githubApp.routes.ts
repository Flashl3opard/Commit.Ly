import { Router } from "express";
import { install, callback, status, repositories } from "./githubApp.controller";
import { search } from "./githubAppSearch.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/install", authMiddleware, install);
router.get("/callback", callback);
router.get("/status", authMiddleware, status);
router.get("/repositories", authMiddleware, repositories);
router.get("/repositories/:repositoryId/search", authMiddleware, search);

export default router;
