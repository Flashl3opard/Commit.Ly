import jwt from "jsonwebtoken";
import { githubAppConfig } from "./githubApp.config";

export class GithubAppApiError extends Error {}

const GITHUB_API_BASE = "https://api.github.com";
const APP_JWT_TTL_SECONDS = 9 * 60; // GitHub allows a max of 10 minutes; stay under it
const APP_JWT_CLOCK_SKEW_SECONDS = 60;

function generateAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - APP_JWT_CLOCK_SKEW_SECONDS,
      exp: now + APP_JWT_TTL_SECONDS,
      iss: githubAppConfig.appId,
    },
    githubAppConfig.privateKey,
    { algorithm: "RS256" }
  );
}

async function githubAppRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${generateAppJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "commitly-github-service",
      ...init?.headers,
    },
  });
}

export type GithubInstallationInfo = {
  installationId: number;
  accountLogin: string;
  accountId: number;
  accountType: string;
  suspended: boolean;
};

type InstallationAccountResponse = {
  login?: string;
  id?: number;
  type?: string;
};

type InstallationResponse = {
  id: number;
  account: InstallationAccountResponse | null;
  suspended_at: string | null;
};

export async function getAppInstallation(installationId: number): Promise<GithubInstallationInfo> {
  const response = await githubAppRequest(`/app/installations/${installationId}`);
  if (response.status === 404) {
    throw new GithubAppApiError("GitHub App installation not found");
  }
  if (!response.ok) {
    throw new GithubAppApiError("Failed to retrieve GitHub App installation");
  }

  const data = (await response.json()) as InstallationResponse;
  const account = data.account;
  if (!account || typeof account.login !== "string" || typeof account.id !== "number") {
    throw new GithubAppApiError("GitHub installation has no associated account");
  }

  return {
    installationId: data.id,
    accountLogin: account.login,
    accountId: account.id,
    accountType: typeof account.type === "string" ? account.type : "User",
    suspended: Boolean(data.suspended_at),
  };
}

type InstallationAccessTokenResponse = {
  token: string;
  expires_at: string;
};

async function createInstallationAccessToken(installationId: number): Promise<string> {
  const response = await githubAppRequest(`/app/installations/${installationId}/access_tokens`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new GithubAppApiError("Failed to create installation access token");
  }
  const data = (await response.json()) as Partial<InstallationAccessTokenResponse>;
  if (!data.token) {
    throw new GithubAppApiError("Malformed installation access token response");
  }
  return data.token;
}

export type GithubRepositoryInfo = {
  githubRepositoryId: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  ownerId: number;
  private: boolean;
  defaultBranch: string | null;
  htmlUrl: string;
};

type InstallationRepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; id: number };
  private: boolean;
  default_branch: string | null;
  html_url: string;
};

type InstallationRepositoriesResponse = {
  total_count: number;
  repositories: InstallationRepositoryResponse[];
};

const REPOS_PER_PAGE = 100;

export async function getInstallationRepositories(installationId: number): Promise<GithubRepositoryInfo[]> {
  // Installation access tokens are generated fresh here and never persisted.
  const accessToken = await createInstallationAccessToken(installationId);
  const repos: InstallationRepositoryResponse[] = [];

  for (let page = 1; ; page++) {
    const response = await fetch(
      `${GITHUB_API_BASE}/installation/repositories?per_page=${REPOS_PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "commitly-github-service",
        },
      }
    );
    if (!response.ok) {
      throw new GithubAppApiError("Failed to retrieve installation repositories");
    }

    const data = (await response.json()) as InstallationRepositoriesResponse;
    repos.push(...data.repositories);

    if (data.repositories.length < REPOS_PER_PAGE) break;
  }

  return repos.map((repo) => ({
    githubRepositoryId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    ownerLogin: repo.owner.login,
    ownerId: repo.owner.id,
    private: repo.private,
    defaultBranch: repo.default_branch ?? null,
    htmlUrl: repo.html_url,
  }));
}
