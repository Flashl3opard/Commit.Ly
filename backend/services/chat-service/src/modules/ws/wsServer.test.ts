import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";

const mockGetRoomMembership = vi.fn();
vi.mock("../room/roomServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../room/roomServiceClient.js")>(
    "../room/roomServiceClient.js",
  );
  return {
    ...actual,
    getRoomMembership: (...args: unknown[]) => mockGetRoomMembership(...args),
  };
});

const ROOM_A = "11111111-1111-4111-8111-111111111111";
const ROOM_B = "22222222-2222-4222-8222-222222222222";
const USER_1 = "user-1";
const USER_2 = "user-2";

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

let httpServer: Server;
let wsUrl: string;
let broadcastMessageEvent: typeof import("./wsServer.js").broadcastMessageEvent;

beforeAll(async () => {
  const { attachWebSocketServer, broadcastMessageEvent: broadcastFn } = await import("./wsServer.js");
  broadcastMessageEvent = broadcastFn;

  httpServer = createServer();
  attachWebSocketServer(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  wsUrl = `ws://localhost:${port}`;
});

afterAll(() => {
  httpServer.close();
});

afterEach(() => {
  vi.clearAllMocks();
});

// A queue per socket, rather than ws.once("message", ...) per call — two
// server-sent frames (e.g. room.joined then presence.snapshot) can arrive
// in the same event-loop tick, before a second sequential `await
// nextMessage()` has registered its listener. Queuing every message as it
// arrives and having nextMessage() drain the queue (or wait for the next
// arrival) avoids losing frames to that race.
const messageQueues = new WeakMap<WebSocket, Record<string, unknown>[]>();
const waiters = new WeakMap<WebSocket, Array<(msg: Record<string, unknown>) => void>>();

function trackMessages(ws: WebSocket) {
  messageQueues.set(ws, []);
  waiters.set(ws, []);
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    const pendingWaiters = waiters.get(ws)!;
    const waiter = pendingWaiters.shift();
    if (waiter) {
      waiter(msg);
    } else {
      messageQueues.get(ws)!.push(msg);
    }
  });
}

function connect(token: string | null, origin = "http://localhost:3000"): Promise<{ ws: WebSocket; statusCode?: number }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: origin };
    if (token) headers.Cookie = `token=${token}`;

    const ws = new WebSocket(wsUrl, { headers });
    const timeout = setTimeout(() => reject(new Error("connect timeout")), 2000);

    ws.on("open", () => {
      clearTimeout(timeout);
      trackMessages(ws);
      resolve({ ws });
    });
    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timeout);
      resolve({ ws, statusCode: res.statusCode });
    });
    ws.on("error", () => {
      // 'unexpected-response' already resolved; ignore the follow-up error.
    });
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  const queue = messageQueues.get(ws);
  if (queue && queue.length > 0) {
    return Promise.resolve(queue.shift()!);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("message timeout")), 2000);
    const pendingWaiters = waiters.get(ws);
    if (!pendingWaiters) {
      reject(new Error("nextMessage() called on a socket that was never connect()ed"));
      return;
    }
    pendingWaiters.push((msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
  });
}

function noMoreMessages(ws: WebSocket, waitMs = 300): Promise<boolean> {
  const queue = messageQueues.get(ws);
  if (queue && queue.length > 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    const pendingWaiters = waiters.get(ws)!;
    const timer = setTimeout(() => {
      const idx = pendingWaiters.indexOf(onMessage);
      if (idx !== -1) pendingWaiters.splice(idx, 1);
      resolve(true);
    }, waitMs);
    function onMessage() {
      clearTimeout(timer);
      resolve(false);
    }
    pendingWaiters.push(onMessage);
  });
}

function send(ws: WebSocket, payload: unknown) {
  ws.send(JSON.stringify(payload));
}

describe("WebSocket authentication", () => {
  it("rejects a connection with no token cookie", async () => {
    const { statusCode } = await connect(null);
    expect(statusCode).toBe(401);
  });

  it("rejects a connection with an invalid token", async () => {
    const { statusCode } = await connect("not-a-real-jwt");
    expect(statusCode).toBe(401);
  });

  it("rejects a connection with an expired token", async () => {
    const expired = signToken(USER_1, -10);
    const { statusCode } = await connect(expired);
    expect(statusCode).toBe(401);
  });

  it("rejects a connection from a disallowed origin", async () => {
    const token = signToken(USER_1);
    const { statusCode } = await connect(token, "http://evil.example.com");
    expect(statusCode).toBe(403);
  });

  it("accepts a connection with a valid token and allowed origin", async () => {
    const token = signToken(USER_1);
    const { ws, statusCode } = await connect(token);
    expect(statusCode).toBeUndefined();
    ws.close();
  });
});

describe("room authorization", () => {
  it("rejects room.join for a non-member with a forbidden error", async () => {
    mockGetRoomMembership.mockResolvedValue(null);
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    send(ws, { type: "room.join", roomId: ROOM_A });
    const reply = await nextMessage(ws);

    expect(reply).toEqual({ type: "error", code: "forbidden", message: "You do not have access to this room." });
    ws.close();
  });

  it("allows room.join for a member and emits room.joined", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    send(ws, { type: "room.join", roomId: ROOM_A });
    const joined = await nextMessage(ws);

    expect(joined).toEqual({ type: "room.joined", roomId: ROOM_A });
    ws.close();
  });

  it("sends presence.snapshot immediately after room.joined", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    send(ws, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws); // room.joined
    const snapshot = await nextMessage(ws);

    expect(snapshot.type).toBe("presence.snapshot");
    expect(snapshot.roomId).toBe(ROOM_A);
    expect(snapshot.users).toEqual(expect.arrayContaining([{ userId: USER_1 }]));
    ws.close();
  });
});

describe("presence", () => {
  it("broadcasts presence.joined to existing members when a second user joins", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token1 = signToken(USER_1);
    const token2 = signToken(USER_2);

    const { ws: ws1 } = await connect(token1);
    send(ws1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws1); // room.joined
    await nextMessage(ws1); // presence.snapshot

    const { ws: ws2 } = await connect(token2);
    send(ws2, { type: "room.join", roomId: ROOM_A });

    const presenceJoinedForWs1 = await nextMessage(ws1);
    expect(presenceJoinedForWs1).toEqual({ type: "presence.joined", roomId: ROOM_A, user: { userId: USER_2 } });

    ws1.close();
    ws2.close();
  });

  it("broadcasts presence.left after the user's last connection closes", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token1 = signToken(USER_1);
    const token2 = signToken(USER_2);

    const { ws: ws1 } = await connect(token1);
    send(ws1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws1);
    await nextMessage(ws1);

    const { ws: ws2 } = await connect(token2);
    send(ws2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws2);
    await nextMessage(ws2);
    await nextMessage(ws1); // presence.joined for USER_2, on ws1

    const leftPromise = nextMessage(ws1);
    ws2.close();
    const left = await leftPromise;

    expect(left).toEqual({ type: "presence.left", roomId: ROOM_A, userId: USER_2 });
    ws1.close();
  });

  it("does not duplicate presence for a second tab of the same user", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);

    const { ws: tab1 } = await connect(token);
    send(tab1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(tab1);
    await nextMessage(tab1);

    const { ws: tab2 } = await connect(token);
    send(tab2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(tab2); // room.joined
    const snapshotForTab2 = await nextMessage(tab2); // presence.snapshot

    // Only one entry for USER_1 despite two connections, and no
    // presence.joined should have been sent to tab1 for its own second tab.
    expect(snapshotForTab2.users).toEqual([{ userId: USER_1 }]);

    tab1.close();
    tab2.close();
  });

  it("user remains online after closing one of two tabs", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const tokenObserver = signToken(USER_2);
    const tokenSubject = signToken(USER_1);

    const { ws: observer } = await connect(tokenObserver);
    send(observer, { type: "room.join", roomId: ROOM_A });
    await nextMessage(observer);
    await nextMessage(observer);

    const { ws: tab1 } = await connect(tokenSubject);
    send(tab1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(tab1);
    await nextMessage(tab1);
    await nextMessage(observer); // presence.joined for USER_1's first tab

    const { ws: tab2 } = await connect(tokenSubject);
    send(tab2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(tab2);
    await nextMessage(tab2);
    // No presence.joined should arrive on `observer` for the second tab.
    expect(await noMoreMessages(observer)).toBe(true);

    tab1.close();
    // Give the server a moment to process the close before asserting.
    await new Promise((r) => setTimeout(r, 200));

    tab2.close();
    observer.close();
  });
});

describe("typing indicators", () => {
  it("broadcasts typing.started to other members", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token1 = signToken(USER_1);
    const token2 = signToken(USER_2);

    const { ws: ws1 } = await connect(token1);
    send(ws1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws1);
    await nextMessage(ws1);

    const { ws: ws2 } = await connect(token2);
    send(ws2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws2);
    await nextMessage(ws2);
    await nextMessage(ws1); // presence.joined

    send(ws2, { type: "typing.start", roomId: ROOM_A });
    const typingEvent = await nextMessage(ws1);

    expect(typingEvent).toEqual({ type: "typing.started", roomId: ROOM_A, user: { userId: USER_2 } });

    ws1.close();
    ws2.close();
  });

  it("broadcasts typing.stopped when the user explicitly stops", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token1 = signToken(USER_1);
    const token2 = signToken(USER_2);

    const { ws: ws1 } = await connect(token1);
    send(ws1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws1);
    await nextMessage(ws1);

    const { ws: ws2 } = await connect(token2);
    send(ws2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws2);
    await nextMessage(ws2);
    await nextMessage(ws1); // presence.joined

    send(ws2, { type: "typing.start", roomId: ROOM_A });
    await nextMessage(ws1); // typing.started

    send(ws2, { type: "typing.stop", roomId: ROOM_A });
    const stopEvent = await nextMessage(ws1);

    expect(stopEvent).toEqual({ type: "typing.stopped", roomId: ROOM_A, userId: USER_2 });

    ws1.close();
    ws2.close();
  });

  it("does not send a typing indicator for the sender's own typing.start", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);
    const { ws } = await connect(token);
    send(ws, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws);
    await nextMessage(ws);

    send(ws, { type: "typing.start", roomId: ROOM_A });

    expect(await noMoreMessages(ws)).toBe(true);

    ws.close();
  });
});

describe("connection cleanup", () => {
  it("cleans up presence when a socket disconnects unexpectedly (no room.leave sent)", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token1 = signToken(USER_1);
    const token2 = signToken(USER_2);

    const { ws: ws1 } = await connect(token1);
    send(ws1, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws1);
    await nextMessage(ws1);

    const { ws: ws2 } = await connect(token2);
    send(ws2, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws2);
    await nextMessage(ws2);
    await nextMessage(ws1); // presence.joined

    const leftPromise = nextMessage(ws1);
    ws2.terminate(); // abrupt disconnect, no room.leave
    const left = await leftPromise;

    expect(left).toEqual({ type: "presence.left", roomId: ROOM_A, userId: USER_2 });
    ws1.close();
  });

  it("cleans up state when switching rooms (leave old room, join new room)", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const observerToken = signToken(USER_2);
    const subjectToken = signToken(USER_1);

    const { ws: observer } = await connect(observerToken);
    send(observer, { type: "room.join", roomId: ROOM_A });
    await nextMessage(observer);
    await nextMessage(observer);

    const { ws: subject } = await connect(subjectToken);
    send(subject, { type: "room.join", roomId: ROOM_A });
    await nextMessage(subject);
    await nextMessage(subject);
    await nextMessage(observer); // presence.joined in room A

    const leftPromise = nextMessage(observer);
    send(subject, { type: "room.leave", roomId: ROOM_A });
    await nextMessage(subject); // room.left
    const left = await leftPromise;
    expect(left).toEqual({ type: "presence.left", roomId: ROOM_A, userId: USER_1 });

    send(subject, { type: "room.join", roomId: ROOM_B });
    const joinedB = await nextMessage(subject);
    expect(joinedB).toEqual({ type: "room.joined", roomId: ROOM_B });

    observer.close();
    subject.close();
  });
});

describe("malformed payload handling", () => {
  it("responds with an error for invalid JSON without closing the connection", async () => {
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    ws.send("{not valid json");
    const reply = await nextMessage(ws);

    expect(reply).toEqual({ type: "error", code: "invalid_payload", message: "Message must be valid JSON." });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("responds with an error for a well-formed but unrecognized message shape", async () => {
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    send(ws, { type: "not.a.real.type", foo: "bar" });
    const reply = await nextMessage(ws);

    expect(reply).toEqual({ type: "error", code: "invalid_payload", message: "Unrecognized message shape." });
    ws.close();
  });

  it("responds with an error for a missing roomId", async () => {
    const token = signToken(USER_1);
    const { ws } = await connect(token);

    send(ws, { type: "room.join" });
    const reply = await nextMessage(ws);

    expect(reply.type).toBe("error");
    ws.close();
  });
});

describe("REST -> WebSocket message broadcast", () => {
  it("broadcastMessageEvent delivers message.created to connected room members", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);
    const { ws } = await connect(token);
    send(ws, { type: "room.join", roomId: ROOM_A });
    await nextMessage(ws);
    await nextMessage(ws);

    const wireMessage = {
      id: "msg-1",
      roomId: ROOM_A,
      channelId: "channel-1",
      userId: USER_1,
      senderType: "user" as const,
      systemEventType: null,
      metadata: null,
      content: "hello",
      parentMessageId: null,
      replyCount: 0,
      mentionedUserIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      editedAt: null,
      deletedAt: null,
    };

    const nextMsgPromise = nextMessage(ws);
    broadcastMessageEvent(ROOM_A, "message.created", wireMessage);
    const received = await nextMsgPromise;

    expect(received).toEqual({ type: "message.created", message: wireMessage });
    ws.close();
  });

  it("broadcastMessageEvent does not deliver to sockets in a different room", async () => {
    mockGetRoomMembership.mockResolvedValue({ role: "MEMBER", joinedAt: "2026-01-01T00:00:00.000Z" });
    const token = signToken(USER_1);
    const { ws } = await connect(token);
    send(ws, { type: "room.join", roomId: ROOM_B });
    await nextMessage(ws);
    await nextMessage(ws);

    const wireMessage = {
      id: "msg-2",
      roomId: ROOM_A,
      channelId: "channel-1",
      userId: USER_1,
      senderType: "user" as const,
      systemEventType: null,
      metadata: null,
      content: "hello",
      parentMessageId: null,
      replyCount: 0,
      mentionedUserIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      editedAt: null,
      deletedAt: null,
    };

    broadcastMessageEvent(ROOM_A, "message.created", wireMessage);

    expect(await noMoreMessages(ws)).toBe(true);

    ws.close();
  });
});
