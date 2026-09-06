"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getMessageHistory, type Message } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/types";
import { getChatSocket } from "./chatSocketInstance";
import type { ConnectionState } from "./ChatSocket";
import type { ServerMessage } from "./protocol";

export type ChatRoomState = {
  messages: Message[];
  loadingInitial: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  loadError: string | null;
  connectionState: ConnectionState;
  onlineUserIds: Set<string>;
  typingUserIds: Set<string>;
  hasNewMessagesBelow: boolean;
};

export type ChatRoomActions = {
  loadOlderMessages: () => Promise<void>;
  notifyScrollPosition: (isNearBottom: boolean) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  /** Merge a message the caller already knows about (e.g. its own optimistic send/edit/delete REST response) without waiting for the WS echo. */
  upsertLocalMessage: (message: Message) => void;
};

const TYPING_STOP_AFTER_MS = 3000;

function upsertMessage(messages: Message[], incoming: Message): Message[] {
  const index = messages.findIndex((m) => m.id === incoming.id);
  if (index === -1) {
    return [...messages, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const next = messages.slice();
  next[index] = incoming;
  return next;
}

type InternalState = ChatRoomState & { roomId: string | null };

type Action =
  | { kind: "reset"; roomId: string | null }
  | { kind: "historyLoaded"; messages: Message[]; nextCursor: string | null }
  | { kind: "olderHistoryLoaded"; messages: Message[]; nextCursor: string | null }
  | { kind: "loadError"; message: string }
  | { kind: "loadingOlder"; value: boolean }
  | { kind: "connectionState"; value: ConnectionState }
  | { kind: "presenceSnapshot"; users: string[] }
  | { kind: "presenceJoined"; userId: string }
  | { kind: "presenceLeft"; userId: string }
  | { kind: "typingStarted"; userId: string }
  | { kind: "typingStopped"; userId: string }
  | { kind: "messageUpserted"; message: Message; markUnseen: boolean }
  | { kind: "scrollPosition"; isNearBottom: boolean };

function initialState(roomId: string | null): InternalState {
  return {
    roomId,
    messages: [],
    loadingInitial: true,
    loadingOlder: false,
    hasMoreOlder: false,
    loadError: null,
    connectionState: "connecting",
    onlineUserIds: new Set(),
    typingUserIds: new Set(),
    hasNewMessagesBelow: false,
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.kind) {
    case "reset":
      return initialState(action.roomId);
    case "historyLoaded":
      return { ...state, messages: action.messages, hasMoreOlder: action.nextCursor !== null, loadingInitial: false };
    case "olderHistoryLoaded": {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newOnes = action.messages.filter((m) => !existingIds.has(m.id));
      return { ...state, messages: [...newOnes, ...state.messages], hasMoreOlder: action.nextCursor !== null };
    }
    case "loadError":
      return { ...state, loadError: action.message, loadingInitial: false, loadingOlder: false };
    case "loadingOlder":
      return { ...state, loadingOlder: action.value };
    case "connectionState":
      return { ...state, connectionState: action.value };
    case "presenceSnapshot":
      return { ...state, onlineUserIds: new Set(action.users) };
    case "presenceJoined":
      return { ...state, onlineUserIds: new Set(state.onlineUserIds).add(action.userId) };
    case "presenceLeft": {
      const next = new Set(state.onlineUserIds);
      next.delete(action.userId);
      return { ...state, onlineUserIds: next };
    }
    case "typingStarted":
      return { ...state, typingUserIds: new Set(state.typingUserIds).add(action.userId) };
    case "typingStopped": {
      const next = new Set(state.typingUserIds);
      next.delete(action.userId);
      return { ...state, typingUserIds: next };
    }
    case "messageUpserted":
      return {
        ...state,
        messages: upsertMessage(state.messages, action.message),
        hasNewMessagesBelow: state.hasNewMessagesBelow || action.markUnseen,
      };
    case "scrollPosition":
      return action.isNearBottom ? { ...state, hasNewMessagesBelow: false } : state;
  }
}

/**
 * Owns messages/presence/typing state for exactly one room at a time.
 * Message identity is deduplicated by id (never by timestamp) so the
 * unavoidable REST-fetch-vs-WebSocket-arrival race — GET history resolving
 * after a message.created event already arrived — never produces a
 * duplicate entry; upserting by id also means message.updated/deleted
 * events replace the existing entry in place instead of appending.
 *
 * All per-room fields live in one reducer keyed by roomId, rather than
 * separate useState calls reset via direct setState calls at the top of an
 * effect — that pattern re-runs the reset synchronously inside the effect
 * body on every roomId change, which is both an anti-pattern (see
 * react-hooks/set-state-in-effect) and the exact bug shape that caused a
 * previous unrelated login-redirect race in this codebase.
 */
export function useChatRoom(roomId: string | null, currentUserId: string | null): ChatRoomState & ChatRoomActions {
  const [state, dispatch] = useReducer(reducer, roomId, initialState);

  const oldestCursorRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Initial history load + room join/leave lifecycle.
  useEffect(() => {
    dispatch({ kind: "reset", roomId });
    oldestCursorRef.current = null;
    isNearBottomRef.current = true;

    if (!roomId) return;

    const socket = getChatSocket();
    let cancelled = false;

    getMessageHistory(roomId)
      .then((page) => {
        if (cancelled) return;
        dispatch({ kind: "historyLoaded", messages: page.messages, nextCursor: page.nextCursor });
        oldestCursorRef.current = page.nextCursor;
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({
          kind: "loadError",
          message: err instanceof ApiError ? err.message : "Couldn't load messages. Please try again.",
        });
      });

    socket.connect();
    socket.send({ type: "room.join", roomId });

    const unsubscribeMessages = socket.onMessage((event: ServerMessage) => {
      switch (event.type) {
        case "presence.snapshot":
          if (event.roomId === roomId) dispatch({ kind: "presenceSnapshot", users: event.users.map((u) => u.userId) });
          break;
        case "presence.joined":
          if (event.roomId === roomId) dispatch({ kind: "presenceJoined", userId: event.user.userId });
          break;
        case "presence.left":
          if (event.roomId === roomId) dispatch({ kind: "presenceLeft", userId: event.userId });
          break;
        case "typing.started":
          if (event.roomId === roomId && event.user.userId !== currentUserId) {
            dispatch({ kind: "typingStarted", userId: event.user.userId });
          }
          break;
        case "typing.stopped":
          if (event.roomId === roomId) dispatch({ kind: "typingStopped", userId: event.userId });
          break;
        case "message.created":
          if (event.message.roomId === roomId) {
            dispatch({
              kind: "messageUpserted",
              message: event.message,
              markUnseen: event.message.userId !== currentUserId && !isNearBottomRef.current,
            });
          }
          break;
        case "message.updated":
        case "message.deleted":
          if (event.message.roomId === roomId) {
            dispatch({ kind: "messageUpserted", message: event.message, markUnseen: false });
          }
          break;
      }
    });

    const unsubscribeState = socket.onStateChange((value) => dispatch({ kind: "connectionState", value }));

    return () => {
      cancelled = true;
      unsubscribeMessages();
      unsubscribeState();
      socket.send({ type: "room.leave", roomId });
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Re-join automatically after a reconnect — the server has no memory of
  // this socket's prior room membership once the underlying connection
  // (and with it, the server-side socket object) is replaced.
  useEffect(() => {
    if (roomId && state.connectionState === "connected") {
      getChatSocket().send({ type: "room.join", roomId });
    }
  }, [roomId, state.connectionState]);

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || !oldestCursorRef.current || state.loadingOlder) return;
    dispatch({ kind: "loadingOlder", value: true });
    try {
      const page = await getMessageHistory(roomId, { before: oldestCursorRef.current });
      dispatch({ kind: "olderHistoryLoaded", messages: page.messages, nextCursor: page.nextCursor });
      oldestCursorRef.current = page.nextCursor;
    } catch (err) {
      dispatch({ kind: "loadError", message: err instanceof ApiError ? err.message : "Couldn't load older messages." });
    } finally {
      dispatch({ kind: "loadingOlder", value: false });
    }
  }, [roomId, state.loadingOlder]);

  const notifyScrollPosition = useCallback((isNearBottom: boolean) => {
    isNearBottomRef.current = isNearBottom;
    dispatch({ kind: "scrollPosition", isNearBottom });
  }, []);

  const sendTypingStart = useCallback(() => {
    if (!roomId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      getChatSocket().send({ type: "typing.start", roomId });
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      getChatSocket().send({ type: "typing.stop", roomId });
    }, TYPING_STOP_AFTER_MS);
  }, [roomId]);

  const sendTypingStop = useCallback(() => {
    if (!roomId) return;
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      getChatSocket().send({ type: "typing.stop", roomId });
    }
  }, [roomId]);

  const upsertLocalMessage = useCallback((message: Message) => {
    dispatch({ kind: "messageUpserted", message, markUnseen: false });
  }, []);

  return {
    messages: state.messages,
    loadingInitial: state.loadingInitial,
    loadingOlder: state.loadingOlder,
    hasMoreOlder: state.hasMoreOlder,
    loadError: state.loadError,
    connectionState: state.connectionState,
    onlineUserIds: state.onlineUserIds,
    typingUserIds: state.typingUserIds,
    hasNewMessagesBelow: state.hasNewMessagesBelow,
    loadOlderMessages,
    notifyScrollPosition,
    sendTypingStart,
    sendTypingStop,
    upsertLocalMessage,
  };
}
