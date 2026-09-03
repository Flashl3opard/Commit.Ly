import { internalConfig } from "../../config/internal";

export class UserServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type LinkedUser = {
  id: string;
  githubUsername: string | null;
  githubVerified: boolean;
};

async function internalRequest<T>(path: string, method: "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(`${internalConfig.userServiceUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-secret": internalConfig.serviceSecret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "User Service request failed";
    throw new UserServiceError(message, response.status);
  }

  return data as T;
}

export async function linkGithubIdentity(
  userId: string,
  githubId: string,
  githubUsername: string,
): Promise<LinkedUser> {
  const { user } = await internalRequest<{ user: LinkedUser }>(
    `/internal/users/${encodeURIComponent(userId)}/github`,
    "PATCH",
    { githubId, githubUsername },
  );
  return user;
}

export async function unlinkGithubIdentity(userId: string): Promise<LinkedUser> {
  const { user } = await internalRequest<{ user: LinkedUser }>(
    `/internal/users/${encodeURIComponent(userId)}/github`,
    "DELETE",
  );
  return user;
}

/**
 * Reads the current GitHub link state for the authenticated user by
 * forwarding their session cookie to User Service's own /users/me — reuses
 * the existing public endpoint rather than duplicating user lookup logic.
 */
export async function getGithubLinkState(cookieHeader: string): Promise<LinkedUser> {
  const response = await fetch(`${internalConfig.userServiceUrl}/users/me`, {
    headers: { cookie: cookieHeader },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? "User Service request failed";
    throw new UserServiceError(message, response.status);
  }

  return (data as { user: LinkedUser }).user;
}
