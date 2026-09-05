import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";

/**
 * Minimum information another service (Room Service) needs to verify
 * ownership of a GitHub repository record and build a safe display —
 * never an installation access token, never a GitHub App secret.
 */
export type InternalRepositoryInfo = {
  id: string;
  githubRepositoryId: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string | null;
  installationOwnerUserId: string;
  accountLogin: string;
  accountType: string;
  active: boolean;
};

export async function getRepositoryById(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const repository = await prisma.githubRepository.findUnique({
    where: { id },
    include: { installation: true },
  });

  if (!repository) {
    return res.status(404).json({ error: "Repository not found" });
  }

  const info: InternalRepositoryInfo = {
    id: repository.id,
    githubRepositoryId: repository.githubRepositoryId.toString(),
    name: repository.name,
    fullName: repository.fullName,
    htmlUrl: repository.htmlUrl,
    private: repository.private,
    defaultBranch: repository.defaultBranch,
    installationOwnerUserId: repository.installation.userId,
    accountLogin: repository.installation.accountLogin,
    accountType: repository.installation.accountType,
    active: repository.installation.active,
  };

  return res.status(200).json({ repository: info });
}
