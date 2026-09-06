import type { WebSocket } from "ws";
import type { ServerMessage } from "./protocol";

/**
 * In-memory, per-process room presence tracking. Deliberately not
 * persisted — presence is ephemeral by design (see README), and this
 * service currently runs as a single process, so a plain Map is
 * sufficient. A user may have multiple sockets in the same room (multiple
 * tabs); presence only changes when their LAST socket in a room leaves.
 */

type RoomId = string;
type UserId = string;

const roomConnections = new Map<RoomId, Map<UserId, Set<WebSocket>>>();

// Reverse index so a socket's cleanup on disconnect doesn't need the
// client to have told us which rooms it was in.
const socketRooms = new Map<WebSocket, Set<RoomId>>();

function getOrCreateRoom(roomId: RoomId): Map<UserId, Set<WebSocket>> {
  let room = roomConnections.get(roomId);
  if (!room) {
    room = new Map();
    roomConnections.set(roomId, room);
  }
  return room;
}

/**
 * Registers a socket as present in a room. Returns whether this was the
 * user's first connection to this room (i.e. whether presence.joined
 * should be broadcast to other members).
 */
export function addConnection(roomId: RoomId, userId: UserId, socket: WebSocket): boolean {
  const room = getOrCreateRoom(roomId);
  let sockets = room.get(userId);
  const isFirstConnection = !sockets;

  if (!sockets) {
    sockets = new Set();
    room.set(userId, sockets);
  }
  sockets.add(socket);

  let rooms = socketRooms.get(socket);
  if (!rooms) {
    rooms = new Set();
    socketRooms.set(socket, rooms);
  }
  rooms.add(roomId);

  return isFirstConnection;
}

/**
 * Removes a socket from a room. Returns whether this was the user's last
 * connection to this room (i.e. whether presence.left should be broadcast).
 */
export function removeConnection(roomId: RoomId, userId: UserId, socket: WebSocket): boolean {
  const room = roomConnections.get(roomId);
  const sockets = room?.get(userId);
  if (!room || !sockets) return false;

  sockets.delete(socket);
  socketRooms.get(socket)?.delete(roomId);

  const wasLastConnection = sockets.size === 0;
  if (wasLastConnection) {
    room.delete(userId);
    if (room.size === 0) {
      roomConnections.delete(roomId);
    }
  }

  return wasLastConnection;
}

/**
 * Removes a socket from every room it was in — called on disconnect, since
 * a closed connection may not have sent room.leave for every room it
 * joined. Returns the list of (roomId, wasLastConnection) so the caller
 * can broadcast presence.left where appropriate.
 */
export function removeSocketFromAllRooms(socket: WebSocket): Array<{ roomId: RoomId; userId: UserId; wasLastConnection: boolean }> {
  const rooms = socketRooms.get(socket);
  if (!rooms) return [];

  const results: Array<{ roomId: RoomId; userId: UserId; wasLastConnection: boolean }> = [];

  for (const roomId of rooms) {
    const room = roomConnections.get(roomId);
    if (!room) continue;

    for (const [userId, sockets] of room) {
      if (sockets.has(socket)) {
        sockets.delete(socket);
        const wasLastConnection = sockets.size === 0;
        if (wasLastConnection) {
          room.delete(userId);
        }
        results.push({ roomId, userId, wasLastConnection });
        break;
      }
    }

    if (room.size === 0) {
      roomConnections.delete(roomId);
    }
  }

  socketRooms.delete(socket);
  return results;
}

export function getRoomPresence(roomId: RoomId): UserId[] {
  const room = roomConnections.get(roomId);
  return room ? Array.from(room.keys()) : [];
}

export function isUserConnectedToRoom(roomId: RoomId, userId: UserId): boolean {
  return Boolean(roomConnections.get(roomId)?.has(userId));
}

function safeSend(socket: WebSocket, payload: ServerMessage) {
  if (socket.readyState !== socket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // A send failing (e.g. socket closing mid-broadcast) must never take
    // down the broadcast loop for other recipients or crash the server.
  }
}

export function sendTo(socket: WebSocket, payload: ServerMessage): void {
  safeSend(socket, payload);
}

/** Sends to every socket a user has open in a room (all their tabs). */
export function sendToUserInRoom(roomId: RoomId, userId: UserId, payload: ServerMessage): void {
  const sockets = roomConnections.get(roomId)?.get(userId);
  if (!sockets) return;
  for (const socket of sockets) safeSend(socket, payload);
}

/** Broadcasts to every connected socket in a room, optionally skipping one. */
export function broadcastToRoom(roomId: RoomId, payload: ServerMessage, options?: { exceptSocket?: WebSocket }): void {
  const room = roomConnections.get(roomId);
  if (!room) return;

  for (const sockets of room.values()) {
    for (const socket of sockets) {
      if (options?.exceptSocket === socket) continue;
      safeSend(socket, payload);
    }
  }
}
