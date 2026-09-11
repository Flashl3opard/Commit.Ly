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

export type UserSearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type FriendRequestSummary = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  otherUser: UserSearchResult;
};

export type FriendSummary = UserSearchResult & { friendsSince: string };

export function searchUsers(username: string): Promise<{ users: UserSearchResult[] }> {
  return userRequest<{ users: UserSearchResult[] }>(`/users/search?username=${encodeURIComponent(username)}`);
}

export function sendFriendRequest(username: string): Promise<{ request: FriendRequestSummary }> {
  return userRequest<{ request: FriendRequestSummary }>("/users/friend-requests", {
    method: "POST",
    body: { username },
  });
}

export function respondToFriendRequest(
  requestId: string,
  action: "accept" | "reject",
): Promise<{ request: FriendRequestSummary }> {
  return userRequest<{ request: FriendRequestSummary }>(`/users/friend-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: { action },
  });
}

export function listFriendRequests(): Promise<{ incoming: FriendRequestSummary[]; outgoing: FriendRequestSummary[] }> {
  return userRequest<{ incoming: FriendRequestSummary[]; outgoing: FriendRequestSummary[] }>("/users/friend-requests");
}

export function listFriends(): Promise<{ friends: FriendSummary[] }> {
  return userRequest<{ friends: FriendSummary[] }>("/users/friends");
}

export function removeFriend(userId: string): Promise<void> {
  return userRequest<void>(`/users/friends/${encodeURIComponent(userId)}`, { method: "DELETE" });
}
