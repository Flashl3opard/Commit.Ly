import { internalConfig } from "../../config/internal";

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Enriches a room member with safe public profile fields via User Service's
 * existing public GET /users/:id endpoint — the same public profile any
 * Commit.ly user can already look up, so no internal secret is needed here.
 * Never fetches or forwards email, passwordHash, or GitHub identity fields.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const response = await fetch(`${internalConfig.userServiceUrl}/users/${encodeURIComponent(userId)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  const user = (data as { user?: PublicProfile } | null)?.user;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}
