import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { authenticateUpgradeRequest, WsAuthError } from "./wsAuth";
import { clientMessageSchema, type ServerMessage, type WireMessage } from "./protocol";
import {
  addConnection,
  removeConnection,
  removeSocketFromAllRooms,
  getRoomPresence,
  sendTo,
  sendToUserInRoom,
  broadcastToRoom,
} from "./connectionManager";
import { startTyping, stopTyping, clearAllTypingForUser } from "./typingTracker";
import { getRoomMembership, RoomServiceClientError } from "../room/roomServiceClient";

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

export { sendToUserInRoom };
