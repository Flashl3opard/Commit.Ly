import { roomRequest } from "./client";

export type RoomRole = "OWNER" | "MEMBER";

export type RoomRepositorySummary = {
  name: string;
  fullName: string;
  htmlUrl: string;
};

export type RoomRepositoryDetails = RoomRepositorySummary & {
  id: string;
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
  customStatus: string | null;
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

export type Channel = {
  id: string;
  roomId: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateChannelRequest = {
  name: string;
  description?: string;
  icon?: string;
};

export type UpdateChannelRequest = Partial<{
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  archived: boolean;
}>;

export type RoomModuleType = "CHAT" | "GITHUB_ACTIVITY" | "MEMBERS" | "TASKS" | "NOTES" | "RELEASES";

export type RoomModule = {
  id: string;
  roomId: string;
  type: RoomModuleType;
  name: string;
  position: number;
  enabled: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRoomModuleRequest = {
  type: RoomModuleType;
  name?: string;
};

export type UpdateRoomModuleRequest = Partial<{
  name: string;
  position: number;
  enabled: boolean;
  config: Record<string, unknown> | null;
}>;

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

export function getChannels(roomId: string): Promise<{ channels: Channel[] }> {
  return roomRequest<{ channels: Channel[] }>(`/rooms/${encodeURIComponent(roomId)}/channels`);
}

export function createChannel(roomId: string, input: CreateChannelRequest): Promise<{ channel: Channel }> {
  return roomRequest<{ channel: Channel }>(`/rooms/${encodeURIComponent(roomId)}/channels`, {
    method: "POST",
    body: input,
  });
}

export function updateChannel(
  roomId: string,
  channelId: string,
  input: UpdateChannelRequest,
): Promise<{ channel: Channel }> {
  return roomRequest<{ channel: Channel }>(
    `/rooms/${encodeURIComponent(roomId)}/channels/${encodeURIComponent(channelId)}`,
    { method: "PATCH", body: input },
  );
}

/** Archives the channel (never a hard delete) — see UpdateChannelRequest.archived for the equivalent PATCH. */
export function archiveChannel(roomId: string, channelId: string): Promise<{ channel: Channel }> {
  return roomRequest<{ channel: Channel }>(
    `/rooms/${encodeURIComponent(roomId)}/channels/${encodeURIComponent(channelId)}`,
    { method: "DELETE" },
  );
}

export function getRoomModules(roomId: string): Promise<{ modules: RoomModule[] }> {
  return roomRequest<{ modules: RoomModule[] }>(`/rooms/${encodeURIComponent(roomId)}/modules`);
}

export function createRoomModule(
  roomId: string,
  input: CreateRoomModuleRequest,
): Promise<{ module: RoomModule }> {
  return roomRequest<{ module: RoomModule }>(`/rooms/${encodeURIComponent(roomId)}/modules`, {
    method: "POST",
    body: input,
  });
}

export function updateRoomModule(
  roomId: string,
  moduleId: string,
  input: UpdateRoomModuleRequest,
): Promise<{ module: RoomModule }> {
  return roomRequest<{ module: RoomModule }>(
    `/rooms/${encodeURIComponent(roomId)}/modules/${encodeURIComponent(moduleId)}`,
    { method: "PATCH", body: input },
  );
}

export function removeRoomModule(roomId: string, moduleId: string): Promise<{ message: string }> {
  return roomRequest<{ message: string }>(
    `/rooms/${encodeURIComponent(roomId)}/modules/${encodeURIComponent(moduleId)}`,
    { method: "DELETE" },
  );
}
