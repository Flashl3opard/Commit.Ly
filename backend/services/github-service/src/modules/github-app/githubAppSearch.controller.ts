import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { searchRepositoryIssuesAndPullRequests, GithubAppApiError } from "./githubAppApi";

const searchQuerySchema = z.object({ q: z.string().trim().min(1) }).strict();

export async function search(req: Request<{ repositoryId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid search query" });
  }

  const repository = await prisma.githubRepository.findUnique({
    where: { id: req.params.repositoryId },
    include: { installation: true },
  });

  if (!repository) {
    return res.status(404).json({ error: "Repository not found" });
  }

  if (repository.installation.userId !== userId || !repository.installation.active) {
    return res.status(403).json({ error: "You do not have access to this repository." });
  }

  try {
    const results = await searchRepositoryIssuesAndPullRequests(
      Number(repository.installation.installationId),
      repository.fullName,
      parsed.data.q,
    );
    return res.status(200).json({ results });
  } catch (err) {
    if (err instanceof GithubAppApiError && err.message === "GitHub search is rate-limited") {
      return res.status(429).json({ error: "GitHub search is temporarily rate-limited. Try again shortly." });
    }
    if (err instanceof GithubAppApiError) {
      return res.status(502).json({ error: "Failed to search GitHub." });
    }
    throw err;
  }
}
