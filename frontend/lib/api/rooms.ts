import { roomRequest } from "./client";

export type RoomRole = "OWNER" | "MEMBER";

export type RoomRepositorySummary = {
  name: string;
  fullName: string;
  htmlUrl: string;
};

export type RoomRepositoryDetails = RoomRepositorySummary & {
  private: boolean;
  defaultBranch: string | null;
};

export type Room = {
  id: string;
  name: string;
  roomCode: string;
  repository: RoomRepositorySummary;
  role: RoomRole;
  createdAt: string;
};

export type RoomMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: string;
};

export type RoomDetails = {
  id: string;
  name: string;
  roomCode: string;
  repository: RoomRepositoryDetails;
  currentUserRole: RoomRole;
  createdAt: string;
  members: RoomMember[];
};

export type CreateRoomRequest = {
  name: string;
  githubRepositoryId: string;
  password: string;
};

export type JoinRoomRequest = {
  roomCode: string;
  password: string;
};

export function getMyRooms(): Promise<{ rooms: Room[] }> {
  return roomRequest<{ rooms: Room[] }>("/rooms");
}

export function getRoom(roomId: string): Promise<{ room: RoomDetails }> {
  return roomRequest<{ room: RoomDetails }>(`/rooms/${encodeURIComponent(roomId)}`);
}

export function createRoom(input: CreateRoomRequest): Promise<{ room: Room }> {
  return roomRequest<{ room: Room }>("/rooms", { method: "POST", body: input });
}

export function joinRoom(input: JoinRoomRequest): Promise<{ room: Room }> {
  return roomRequest<{ room: Room }>("/rooms/join", { method: "POST", body: input });
}

export function leaveRoom(roomId: string): Promise<{ message: string }> {
  return roomRequest<{ message: string }>(`/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
}

export function deleteRoom(roomId: string): Promise<{ message: string }> {
  return roomRequest<{ message: string }>(`/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
}
