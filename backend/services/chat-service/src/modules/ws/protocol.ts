import { z } from "zod";

/**
 * Small, explicit, strongly-typed WebSocket protocol. One JSON object per
 * frame, always carrying a `type` discriminant. Client -> server messages
 * are validated with zod before any handler runs; malformed frames never
 * crash the connection (see wsServer.ts), they just produce an `error`
 * frame back to the sender.
 */

// ---- Client -> Server -------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room.join"), roomId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("room.leave"), roomId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("typing.start"), roomId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("typing.stop"), roomId: z.string().uuid() }).strict(),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---- Shared payload shapes ---------------------------------------------

/**
 * The only user information ever broadcast over the socket. Deliberately
 * userId-only — no displayName/avatarUrl — so Chat Service never needs a
 * per-connection/per-event User Service call. The frontend already has the
 * full room member list (with profile fields) from Room Service and
 * resolves identity locally, the same documented approach already used for
 * message sender data.
 */
export type PresenceUser = {
  userId: string;
};

export type WireMessage = {
  id: string;
  roomId: string;
  channelId: string;
  userId: string | null;
  senderType: "user" | "system";
  systemEventType: string | null;
  metadata: Record<string, unknown> | null;
  content: string | null;
  parentMessageId: string | null;
  replyCount: number;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type ErrorCode =
  | "invalid_payload"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "internal_error";

// ---- Server -> Client ----------------------------------------------------

export type ServerMessage =
  | { type: "room.joined"; roomId: string }
  | { type: "room.left"; roomId: string }
  | { type: "message.created"; message: WireMessage }
  | { type: "message.updated"; message: WireMessage }
  | { type: "message.deleted"; message: WireMessage }
  | { type: "presence.snapshot"; roomId: string; users: PresenceUser[] }
  | { type: "presence.joined"; roomId: string; user: PresenceUser }
  | { type: "presence.left"; roomId: string; userId: string }
  | { type: "typing.started"; roomId: string; user: PresenceUser }
  | { type: "typing.stopped"; roomId: string; userId: string }
  | { type: "error"; code: ErrorCode; message: string };
