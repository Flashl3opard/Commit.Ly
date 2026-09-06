import { describe, it, expect, vi, beforeEach } from "vitest";

function fakeSocket() {
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn(),
  } as unknown as import("ws").WebSocket;
}

describe("connectionManager", () => {
  const ROOM_A = "room-a";
  const ROOM_B = "room-b";
  const USER_1 = "user-1";
  const USER_2 = "user-2";

  // Each module import gets a fresh copy of the in-memory maps since
  // vi.resetModules() + a fresh dynamic import per test avoids state
  // leaking between tests (the module holds module-level Maps, not
  // exported classes you could instantiate fresh).
  beforeEach(() => {
    vi.resetModules();
  });

  it("addConnection returns true for a user's first connection to a room", async () => {
    const cm = await import("./connectionManager.js");
    const socket = fakeSocket();
    const isFirst = cm.addConnection(ROOM_A, USER_1, socket);
    expect(isFirst).toBe(true);
  });

  it("addConnection returns false for a second tab of the same user in the same room", async () => {
    const cm = await import("./connectionManager.js");
    const socket1 = fakeSocket();
    const socket2 = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket1);
    const isFirst = cm.addConnection(ROOM_A, USER_1, socket2);
    expect(isFirst).toBe(false);
  });

  it("getRoomPresence lists each user only once even with multiple connections", async () => {
    const cm = await import("./connectionManager.js");
    cm.addConnection(ROOM_A, USER_1, fakeSocket());
    cm.addConnection(ROOM_A, USER_1, fakeSocket());
    cm.addConnection(ROOM_A, USER_2, fakeSocket());
    expect(cm.getRoomPresence(ROOM_A).sort()).toEqual([USER_1, USER_2].sort());
  });

  it("removeConnection returns false while another connection for the user remains", async () => {
    const cm = await import("./connectionManager.js");
    const socket1 = fakeSocket();
    const socket2 = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket1);
    cm.addConnection(ROOM_A, USER_1, socket2);

    const wasLast = cm.removeConnection(ROOM_A, USER_1, socket1);
    expect(wasLast).toBe(false);
    expect(cm.isUserConnectedToRoom(ROOM_A, USER_1)).toBe(true);
  });

  it("removeConnection returns true when the last connection for the user closes", async () => {
    const cm = await import("./connectionManager.js");
    const socket = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket);

    const wasLast = cm.removeConnection(ROOM_A, USER_1, socket);
    expect(wasLast).toBe(true);
    expect(cm.isUserConnectedToRoom(ROOM_A, USER_1)).toBe(false);
  });

  it("removeSocketFromAllRooms cleans up a socket present in multiple rooms", async () => {
    const cm = await import("./connectionManager.js");
    const socket = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket);
    cm.addConnection(ROOM_B, USER_1, socket);

    const results = cm.removeSocketFromAllRooms(socket);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.wasLastConnection)).toBe(true);
    expect(cm.isUserConnectedToRoom(ROOM_A, USER_1)).toBe(false);
    expect(cm.isUserConnectedToRoom(ROOM_B, USER_1)).toBe(false);
  });

  it("removeSocketFromAllRooms only reports wasLastConnection: false when another tab remains", async () => {
    const cm = await import("./connectionManager.js");
    const socket1 = fakeSocket();
    const socket2 = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket1);
    cm.addConnection(ROOM_A, USER_1, socket2);

    const results = cm.removeSocketFromAllRooms(socket1);

    expect(results).toEqual([{ roomId: ROOM_A, userId: USER_1, wasLastConnection: false }]);
    expect(cm.isUserConnectedToRoom(ROOM_A, USER_1)).toBe(true);
  });

  it("broadcastToRoom sends to every socket in the room", async () => {
    const cm = await import("./connectionManager.js");
    const socket1 = fakeSocket();
    const socket2 = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket1);
    cm.addConnection(ROOM_A, USER_2, socket2);

    cm.broadcastToRoom(ROOM_A, { type: "room.joined", roomId: ROOM_A });

    expect(socket1.send).toHaveBeenCalledOnce();
    expect(socket2.send).toHaveBeenCalledOnce();
  });

  it("broadcastToRoom can exclude the sender's own socket", async () => {
    const cm = await import("./connectionManager.js");
    const socket1 = fakeSocket();
    const socket2 = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, socket1);
    cm.addConnection(ROOM_A, USER_2, socket2);

    cm.broadcastToRoom(ROOM_A, { type: "room.joined", roomId: ROOM_A }, { exceptSocket: socket1 });

    expect(socket1.send).not.toHaveBeenCalled();
    expect(socket2.send).toHaveBeenCalledOnce();
  });

  it("broadcastToRoom does not throw for a room with no connections", async () => {
    const cm = await import("./connectionManager.js");
    expect(() => cm.broadcastToRoom("nonexistent-room", { type: "room.joined", roomId: "x" })).not.toThrow();
  });

  it("sendTo does not throw and does not send when the socket is not open", async () => {
    const cm = await import("./connectionManager.js");
    const socket = fakeSocket();
    (socket as unknown as { readyState: number }).readyState = 3; // CLOSED
    cm.sendTo(socket, { type: "room.joined", roomId: ROOM_A });
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("a failing socket.send does not throw or affect other recipients", async () => {
    const cm = await import("./connectionManager.js");
    const badSocket = fakeSocket();
    (badSocket.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("simulated send failure");
    });
    const goodSocket = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, badSocket);
    cm.addConnection(ROOM_A, USER_2, goodSocket);

    expect(() => cm.broadcastToRoom(ROOM_A, { type: "room.joined", roomId: ROOM_A })).not.toThrow();
    expect(goodSocket.send).toHaveBeenCalledOnce();
  });

  it("sendToUserInRoom only sends to that user's own sockets", async () => {
    const cm = await import("./connectionManager.js");
    const userSocket = fakeSocket();
    const otherSocket = fakeSocket();
    cm.addConnection(ROOM_A, USER_1, userSocket);
    cm.addConnection(ROOM_A, USER_2, otherSocket);

    cm.sendToUserInRoom(ROOM_A, USER_1, { type: "room.joined", roomId: ROOM_A });

    expect(userSocket.send).toHaveBeenCalledOnce();
    expect(otherSocket.send).not.toHaveBeenCalled();
  });
});
