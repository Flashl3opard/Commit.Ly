import { internalConfig } from "../../config/internal";

export class GithubServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

/**
 * Looks up a GitHub repository record via GitHub Service's internal API.
 * Returns null if the repository does not exist — callers decide whether
 * that means 404. Never returns installation access tokens or App secrets;
 * GitHub Service's internal endpoint doesn't expose them in the first place.
 */
export async function getRepositoryById(repositoryId: string): Promise<InternalRepositoryInfo | null> {
  const response = await fetch(
    `${internalConfig.githubServiceUrl}/internal/github/repositories/${encodeURIComponent(repositoryId)}`,
    {
      headers: { "x-internal-service-secret": internalConfig.serviceSecret },
    },
  );

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "GitHub Service request failed";
    throw new GithubServiceError(message, response.status);
  }

  return (data as { repository: InternalRepositoryInfo }).repository;
}
