import { userRequest } from "./client";
import type { PrivateUser, PublicProfile, UpdateProfileInput } from "./types";

export function getCurrentUser(): Promise<{ user: PrivateUser }> {
  return userRequest<{ user: PrivateUser }>("/users/me");
}

export function updateCurrentUser(input: UpdateProfileInput): Promise<{ user: PrivateUser }> {
  return userRequest<{ user: PrivateUser }>("/users/me", {
    method: "PATCH",
    body: input,
  });
}

export function getUserProfile(id: string): Promise<{ user: PublicProfile }> {
  return userRequest<{ user: PublicProfile }>(`/users/${encodeURIComponent(id)}`);
}
