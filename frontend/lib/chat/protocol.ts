import type { Message } from "@/lib/api/chat";

/**
 * Mirrors backend/services/chat-service/src/modules/ws/protocol.ts exactly.
 * Keep both in sync by hand — this is intentionally small enough that a
 * shared package would be overkill for two services.
 */

export type ClientMessage =
  | { type: "room.join"; roomId: string }
  | { type: "room.leave"; roomId: string }
  | { type: "typing.start"; roomId: string }
  | { type: "typing.stop"; roomId: string };

export type PresenceUser = {
  userId: string;
};

export type ErrorCode = "invalid_payload" | "unauthorized" | "forbidden" | "not_found" | "internal_error";

export type ServerMessage =
  | { type: "room.joined"; roomId: string }
  | { type: "room.left"; roomId: string }
  | { type: "message.created"; message: Message }
  | { type: "message.updated"; message: Message }
  | { type: "message.deleted"; message: Message }
  | { type: "presence.snapshot"; roomId: string; users: PresenceUser[] }
  | { type: "presence.joined"; roomId: string; user: PresenceUser }
  | { type: "presence.left"; roomId: string; userId: string }
  | { type: "typing.started"; roomId: string; user: PresenceUser }
  | { type: "typing.stopped"; roomId: string; userId: string }
  | { type: "error"; code: ErrorCode; message: string };
