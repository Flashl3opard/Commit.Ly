import { githubRequest } from "./client";

export type GithubStatus = {
  connected: boolean;
  github: { username: string } | null;
  verified: boolean;
};

export function getGithubStatus(): Promise<GithubStatus> {
  return githubRequest<GithubStatus>("/github/status");
}

export function disconnectGithub(): Promise<GithubStatus> {
  return githubRequest<GithubStatus>("/github/disconnect", { method: "DELETE" });
}

/**
 * Not a fetch call — navigates the browser to GitHub Service's OAuth entry
 * point so the existing session cookie flows along with the redirect.
 */
export function connectGithubUrl(from?: "onboarding"): string {
  const baseUrl = process.env.NEXT_PUBLIC_GITHUB_API_URL;
  const query = from ? `?from=${encodeURIComponent(from)}` : "";
  return `${baseUrl}/github/connect${query}`;
}
