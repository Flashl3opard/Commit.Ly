import { githubConfig } from "../../config/github";

export class GithubApiError extends Error {}

type TokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

type GithubUserResponse = {
  id: number;
  login: string;
};

/**
 * Exchanges a temporary authorization code for a GitHub access token.
 * The token is used once (to fetch identity) and is never persisted or
 * returned to the caller beyond this module.
 */
export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
  const response = await fetch(githubConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: githubConfig.clientId,
      client_secret: githubConfig.clientSecret,
      code,
      redirect_uri: githubConfig.callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new GithubApiError("GitHub token exchange failed");
  }

  const data = (await response.json()) as Partial<TokenResponse> & { error?: string };

  if (data.error || !data.access_token) {
    throw new GithubApiError("GitHub token exchange failed");
  }

  return data.access_token;
}

/**
 * Fetches the authenticated GitHub user's stable identity (id + login)
 * using a short-lived access token that is discarded immediately after.
 */
export async function fetchGithubIdentity(
  accessToken: string,
): Promise<{ githubId: string; githubUsername: string }> {
  const response = await fetch(githubConfig.userApiUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "commitly-github-service",
    },
  });

  if (!response.ok) {
    throw new GithubApiError("Failed to fetch GitHub identity");
  }

  const data = (await response.json()) as Partial<GithubUserResponse>;

  if (typeof data.id !== "number" || typeof data.login !== "string" || !data.login) {
    throw new GithubApiError("Malformed GitHub identity response");
  }

  return { githubId: String(data.id), githubUsername: data.login };
}
