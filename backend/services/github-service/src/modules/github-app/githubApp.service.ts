import { prisma } from "../../config/prisma";
import { getGithubIdentity } from "../github/userServiceClient";
import { getAppInstallation, getInstallationRepositories } from "./githubAppApi";

export class GithubAppServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Confirms the user has a verified GitHub OAuth identity before allowing a
 * GitHub App installation to begin — required so a personal installation's
 * account can later be checked against a known githubId.
 */
export async function assertGithubIdentityVerified(userId: string): Promise<void> {
  const identity = await getGithubIdentity(userId);
  if (!identity.githubVerified || !identity.githubId) {
    throw new GithubAppServiceError(
      "Connect your GitHub account before installing the Commit.ly GitHub App.",
      400,
    );
  }
}

export type StoredInstallationSummary = {
  accountLogin: string;
  accountType: string;
};

export async function getInstallationStatusForUser(
  userId: string,
): Promise<{ installed: boolean; installation: StoredInstallationSummary | null }> {
  const installation = await prisma.githubInstallation.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (!installation) {
    return { installed: false, installation: null };
  }

  return {
    installed: true,
    installation: {
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
    },
  };
}

export type SafeRepository = {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
  htmlUrl: string;
};

export async function getRepositoriesForUser(userId: string): Promise<SafeRepository[]> {
  const repos = await prisma.githubRepository.findMany({
    where: { installation: { userId, active: true } },
    orderBy: { fullName: "asc" },
  });

  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    private: repo.private,
    defaultBranch: repo.defaultBranch,
    htmlUrl: repo.htmlUrl,
  }));
}

/**
 * Verifies a freshly-installed GitHub App installation belongs to the
 * expected user, then persists the installation and its repositories.
 * Idempotent: safe to call again for the same installationId (e.g. a
 * duplicate callback) — upserts rather than inserting blindly.
 */
export async function verifyAndStoreInstallation(userId: string, installationId: number): Promise<void> {
  const identity = await getGithubIdentity(userId);
  if (!identity.githubVerified || !identity.githubId) {
    throw new GithubAppServiceError("GitHub identity is not verified for this account.", 400);
  }

  const installationInfo = await getAppInstallation(installationId);

  if (installationInfo.accountType === "User" && String(installationInfo.accountId) !== identity.githubId) {
    throw new GithubAppServiceError(
      "This GitHub App installation belongs to a different GitHub account than the one connected to your Commit.ly profile.",
      403,
    );
  }

  const existing = await prisma.githubInstallation.findUnique({
    where: { installationId: BigInt(installationInfo.installationId) },
  });
  if (existing && existing.userId !== userId) {
    throw new GithubAppServiceError(
      "This GitHub App installation is already linked to a different Commit.ly account.",
      409,
    );
  }

  const installation = await prisma.githubInstallation.upsert({
    where: { installationId: BigInt(installationInfo.installationId) },
    create: {
      userId,
      installationId: BigInt(installationInfo.installationId),
      accountLogin: installationInfo.accountLogin,
      accountId: BigInt(installationInfo.accountId),
      accountType: installationInfo.accountType,
      suspended: installationInfo.suspended,
      active: true,
    },
    update: {
      accountLogin: installationInfo.accountLogin,
      accountId: BigInt(installationInfo.accountId),
      accountType: installationInfo.accountType,
      suspended: installationInfo.suspended,
      active: true,
    },
  });

  const repositories = await getInstallationRepositories(installationInfo.installationId);

  await prisma.$transaction(
    repositories.map((repo) =>
      prisma.githubRepository.upsert({
        where: {
          installationId_githubRepositoryId: {
            installationId: installation.id,
            githubRepositoryId: BigInt(repo.githubRepositoryId),
          },
        },
        create: {
          installationId: installation.id,
          githubRepositoryId: BigInt(repo.githubRepositoryId),
          name: repo.name,
          fullName: repo.fullName,
          ownerLogin: repo.ownerLogin,
          ownerId: BigInt(repo.ownerId),
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
        },
        update: {
          name: repo.name,
          fullName: repo.fullName,
          ownerLogin: repo.ownerLogin,
          ownerId: BigInt(repo.ownerId),
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
        },
      }),
    ),
  );
}
