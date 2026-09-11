import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { authenticateUpgradeRequest, WsAuthError } from "./wsAuth";
import { clientMessageSchema, type ServerMessage, type WireMessage, type DmWireMessage } from "./protocol";
import {
  addConnection,
  removeConnection,
  removeSocketFromAllRooms,
  getRoomPresence,
  sendTo,
  sendToUserInRoom,
  broadcastToRoom,
  addDmConnection,
  removeDmConnection,
  removeSocketFromAllDmConversations,
  broadcastToDmConversation,
} from "./connectionManager";
import { startTyping, stopTyping, clearAllTypingForUser } from "./typingTracker";
import { getRoomMembership, RoomServiceClientError } from "../room/roomServiceClient";
import { assertConversationParticipant, DmServiceError } from "../dm/dm.service";

const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN;

type AuthenticatedSocket = WebSocket & { userId: string };

function send(socket: WebSocket, payload: ServerMessage) {
  sendTo(socket, payload);
}

function sendError(socket: WebSocket, code: "invalid_payload" | "unauthorized" | "forbidden" | "not_found" | "internal_error", message: string) {
  send(socket, { type: "error", code, message });
}

/**
 * Verifies the connection's user is currently a member of the room via
 * Room Service's internal endpoint — the same authoritative check the
 * REST message endpoints already use. Never trusts room membership
 * supplied by the client; a socket only ever learns it can act in a room
 * after this succeeds.
 */
async function verifyMembership(roomId: string, userId: string): Promise<boolean> {
  try {
    const membership = await getRoomMembership(roomId, userId);
    return membership !== null;
  } catch (err) {
    if (err instanceof RoomServiceClientError) return false;
    throw err;
  }
}

async function handleRoomJoin(socket: AuthenticatedSocket, roomId: string) {
  const isMember = await verifyMembership(roomId, socket.userId);
  if (!isMember) {
    sendError(socket, "forbidden", "You do not have access to this room.");
    return;
  }

  const isFirstConnection = addConnection(roomId, socket.userId, socket);

  send(socket, { type: "room.joined", roomId });
  send(socket, { type: "presence.snapshot", roomId, users: getRoomPresence(roomId).map((userId) => ({ userId })) });

  if (isFirstConnection) {
    broadcastToRoom(roomId, { type: "presence.joined", roomId, user: { userId: socket.userId } }, { exceptSocket: socket });
  }
}

function handleRoomLeave(socket: AuthenticatedSocket, roomId: string) {
  const wasLastConnection = removeConnection(roomId, socket.userId, socket);
  send(socket, { type: "room.left", roomId });

  if (wasLastConnection) {
    broadcastToRoom(roomId, { type: "presence.left", roomId, userId: socket.userId });
  }

  if (stopTyping(roomId, socket.userId)) {
    broadcastToRoom(roomId, { type: "typing.stopped", roomId, userId: socket.userId });
  }
}

async function handleTypingStart(socket: AuthenticatedSocket, roomId: string) {
  // Membership is re-checked here (not just at room.join) since a stale
  // socket could otherwise keep sending typing events for a room the user
  // has since left/lost access to.
  const isMember = await verifyMembership(roomId, socket.userId);
  if (!isMember) {
    sendError(socket, "forbidden", "You do not have access to this room.");
    return;
  }

  const isNewTypingState = startTyping(roomId, socket.userId, () => {
    broadcastToRoom(roomId, { type: "typing.stopped", roomId, userId: socket.userId });
  });

  if (isNewTypingState) {
    broadcastToRoom(roomId, { type: "typing.started", roomId, user: { userId: socket.userId } }, { exceptSocket: socket });
  }
}

function handleTypingStop(socket: AuthenticatedSocket, roomId: string) {
  if (stopTyping(roomId, socket.userId)) {
    broadcastToRoom(roomId, { type: "typing.stopped", roomId, userId: socket.userId }, { exceptSocket: socket });
  }
}

function handleDisconnect(socket: AuthenticatedSocket) {
  const removals = removeSocketFromAllRooms(socket);
  for (const { roomId, wasLastConnection } of removals) {
    if (wasLastConnection) {
      broadcastToRoom(roomId, { type: "presence.left", roomId, userId: socket.userId });
    }
  }

  const typingCleared = clearAllTypingForUser(socket.userId);
  for (const { roomId } of typingCleared) {
    broadcastToRoom(roomId, { type: "typing.stopped", roomId, userId: socket.userId });
  }

  removeSocketFromAllDmConversations(socket);
}

/**
 * Verifies the connection's user is a genuine participant of the DM
 * conversation via dm.service.ts's ownership check — the same
 * authoritative check the REST DM endpoints already use. Never trusts
 * conversation participation supplied by the client.
 */
async function verifyDmParticipant(conversationId: string, userId: string): Promise<boolean> {
  try {
    await assertConversationParticipant(conversationId, userId);
    return true;
  } catch (err) {
    if (err instanceof DmServiceError) return false;
    throw err;
  }
}

async function handleDmJoin(socket: AuthenticatedSocket, conversationId: string) {
  const isParticipant = await verifyDmParticipant(conversationId, socket.userId);
  if (!isParticipant) {
    sendError(socket, "forbidden", "You do not have access to this conversation.");
    return;
  }

  addDmConnection(conversationId, socket.userId, socket);
  send(socket, { type: "dm.joined", conversationId });
}

function handleDmLeave(socket: AuthenticatedSocket, conversationId: string) {
  removeDmConnection(conversationId, socket.userId, socket);
  send(socket, { type: "dm.left", conversationId });

  if (stopTyping(conversationId, socket.userId)) {
    broadcastToDmConversation(conversationId, { type: "dm.typing.stopped", conversationId, userId: socket.userId });
  }
}

async function handleDmTypingStart(socket: AuthenticatedSocket, conversationId: string) {
  const isParticipant = await verifyDmParticipant(conversationId, socket.userId);
  if (!isParticipant) {
    sendError(socket, "forbidden", "You do not have access to this conversation.");
    return;
  }

  const isNewTypingState = startTyping(conversationId, socket.userId, () => {
    broadcastToDmConversation(conversationId, { type: "dm.typing.stopped", conversationId, userId: socket.userId });
  });

  if (isNewTypingState) {
    broadcastToDmConversation(
      conversationId,
      { type: "dm.typing.started", conversationId, userId: socket.userId },
      { exceptSocket: socket },
    );
  }
}

function handleDmTypingStop(socket: AuthenticatedSocket, conversationId: string) {
  if (stopTyping(conversationId, socket.userId)) {
    broadcastToDmConversation(
      conversationId,
      { type: "dm.typing.stopped", conversationId, userId: socket.userId },
      { exceptSocket: socket },
    );
  }
}

function handleClientMessage(socket: AuthenticatedSocket, raw: string) {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    sendError(socket, "invalid_payload", "Message must be valid JSON.");
    return;
  }

  const parsed = clientMessageSchema.safeParse(parsedJson);
  if (!parsed.success) {
    sendError(socket, "invalid_payload", "Unrecognized message shape.");
    return;
  }

  const message = parsed.data;
  switch (message.type) {
    case "room.join":
      void handleRoomJoin(socket, message.roomId);
      return;
    case "room.leave":
      handleRoomLeave(socket, message.roomId);
      return;
    case "typing.start":
      void handleTypingStart(socket, message.roomId);
      return;
    case "typing.stop":
      handleTypingStop(socket, message.roomId);
      return;
    case "dm.join":
      void handleDmJoin(socket, message.conversationId);
      return;
    case "dm.leave":
      handleDmLeave(socket, message.conversationId);
      return;
    case "dm.typing.start":
      void handleDmTypingStart(socket, message.conversationId);
      return;
    case "dm.typing.stop":
      handleDmTypingStop(socket, message.conversationId);
      return;
  }
}

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    // Only same-origin connections from the local frontend are accepted —
    // this is not disabled for development, matching the CORS policy the
    // REST API already enforces.
    const origin = req.headers.origin;
    if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      ({ userId } = authenticateUpgradeRequest(req));
    } catch (err) {
      if (err instanceof WsAuthError) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      (ws as AuthenticatedSocket).userId = userId;
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    const socket = ws as AuthenticatedSocket;

    socket.on("message", (data) => {
      // A malformed frame must produce an error response, never crash the
      // connection or the server.
      try {
        handleClientMessage(socket, data.toString());
      } catch {
        sendError(socket, "internal_error", "Something went wrong. Please try again.");
      }
    });

    socket.on("close", () => {
      handleDisconnect(socket);
    });

    socket.on("error", () => {
      // A socket-level error will be followed by a 'close' event, which
      // performs the actual cleanup — nothing additional to do here beyond
      // ensuring this handler exists so an unhandled 'error' can't crash
      // the process.
    });
  });

  return wss;
}

/**
 * Broadcasts a message-lifecycle event to every connected member of a room.
 * Called from the REST message controllers after a successful database
 * write — REST remains the sole write path; this is purely a notification
 * layer on top of it, never a second source of truth.
 */
export function broadcastMessageEvent(
  roomId: string,
  type: "message.created" | "message.updated" | "message.deleted",
  message: WireMessage,
): void {
  broadcastToRoom(roomId, { type, message });
}

/**
 * Broadcasts a DM message-lifecycle event to every connected socket of
 * both conversation participants. Called from the REST DM controllers
 * after a successful database write — same "REST writes, WS notifies"
 * discipline as broadcastMessageEvent.
 */
export function broadcastDmMessageEvent(
  conversationId: string,
  type: "dm.message.created" | "dm.message.updated" | "dm.message.deleted",
  message: DmWireMessage,
): void {
  broadcastToDmConversation(conversationId, { type, message });
}

export { sendToUserInRoom };
