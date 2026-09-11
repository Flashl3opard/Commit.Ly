"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getDmMessageHistory, type DmMessage } from "@/lib/api/dm";
import { ApiError } from "@/lib/api/types";
import { getChatSocket } from "./chatSocketInstance";
import type { ConnectionState } from "./ChatSocket";
import type { ServerMessage } from "./protocol";

export type DmConversationState = {
  messages: DmMessage[];
  loadingInitial: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  loadError: string | null;
  connectionState: ConnectionState;
  typingUserIds: Set<string>;
};

export type DmConversationActions = {
  loadOlderMessages: () => Promise<void>;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  upsertLocalMessage: (message: DmMessage) => void;
};

const TYPING_STOP_AFTER_MS = 3000;

function upsertMessage(messages: DmMessage[], incoming: DmMessage): DmMessage[] {
  const index = messages.findIndex((m) => m.id === incoming.id);
  if (index === -1) {
    return [...messages, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const next = messages.slice();
  next[index] = incoming;
  return next;
}

type InternalState = DmConversationState & { conversationId: string | null };

type Action =
  | { kind: "reset"; conversationId: string | null }
  | { kind: "historyLoaded"; messages: DmMessage[]; nextCursor: string | null }
  | { kind: "olderHistoryLoaded"; messages: DmMessage[]; nextCursor: string | null }
  | { kind: "loadError"; message: string }
  | { kind: "loadingOlder"; value: boolean }
  | { kind: "connectionState"; value: ConnectionState }
  | { kind: "typingStarted"; userId: string }
  | { kind: "typingStopped"; userId: string }
  | { kind: "messageUpserted"; message: DmMessage };

function initialState(conversationId: string | null): InternalState {
  return {
    conversationId,
    messages: [],
    loadingInitial: true,
    loadingOlder: false,
    hasMoreOlder: false,
    loadError: null,
    connectionState: "connecting",
    typingUserIds: new Set(),
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.kind) {
    case "reset":
      return initialState(action.conversationId);
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
    case "typingStarted":
      return { ...state, typingUserIds: new Set(state.typingUserIds).add(action.userId) };
    case "typingStopped": {
      const next = new Set(state.typingUserIds);
      next.delete(action.userId);
      return { ...state, typingUserIds: next };
    }
    case "messageUpserted":
      return { ...state, messages: upsertMessage(state.messages, action.message) };
  }
}

/**
 * Owns messages/typing state for exactly one DM conversation at a time —
 * the DM analogue of useChatRoom, minus presence (DMs don't show an
 * online-members list) and minus the room/channel split (a DM
 * conversation has no sub-scoping). join/leave here still tracks the WS
 * connection lifecycle the same way room.join/room.leave does.
 */
export function useDmConversation(
  conversationId: string | null,
  currentUserId: string | null,
): DmConversationState & DmConversationActions {
  const [state, dispatch] = useReducer(reducer, conversationId, initialState);

  // Mirrors useChatRoom's oldestCursorRef — the opaque pagination cursor
  // returned by the API, never re-derived from a message's own fields.
  const oldestCursorRef = useRef<string | null>(null);

  useEffect(() => {
    dispatch({ kind: "reset", conversationId });
    oldestCursorRef.current = null;
    let cancelled = false;

    if (!conversationId) return;

    getDmMessageHistory(conversationId)
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

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const socket = getChatSocket();
    socket.connect();
    socket.send({ type: "dm.join", conversationId });

    const unsubscribeMessages = socket.onMessage((event: ServerMessage) => {
      switch (event.type) {
        case "dm.typing.started":
          if (event.conversationId === conversationId && event.userId !== currentUserId) {
            dispatch({ kind: "typingStarted", userId: event.userId });
          }
          break;
        case "dm.typing.stopped":
          if (event.conversationId === conversationId) {
            dispatch({ kind: "typingStopped", userId: event.userId });
          }
          break;
        case "dm.message.created":
        case "dm.message.updated":
        case "dm.message.deleted":
          if (event.message.conversationId === conversationId) {
            dispatch({ kind: "messageUpserted", message: event.message });
          }
          break;
      }
    });

    const unsubscribeState = socket.onStateChange((value) => dispatch({ kind: "connectionState", value }));

    return () => {
      unsubscribeMessages();
      unsubscribeState();
      socket.send({ type: "dm.leave", conversationId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && state.connectionState === "connected") {
      getChatSocket().send({ type: "dm.join", conversationId });
    }
  }, [conversationId, state.connectionState]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !oldestCursorRef.current || state.loadingOlder) return;
    dispatch({ kind: "loadingOlder", value: true });
    try {
      const page = await getDmMessageHistory(conversationId, { before: oldestCursorRef.current });
      dispatch({ kind: "olderHistoryLoaded", messages: page.messages, nextCursor: page.nextCursor });
      oldestCursorRef.current = page.nextCursor;
    } catch (err) {
      dispatch({ kind: "loadError", message: err instanceof ApiError ? err.message : "Couldn't load older messages." });
    } finally {
      dispatch({ kind: "loadingOlder", value: false });
    }
  }, [conversationId, state.loadingOlder]);

  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const sendTypingStart = useCallback(() => {
    if (!conversationId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      getChatSocket().send({ type: "dm.typing.start", conversationId });
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      getChatSocket().send({ type: "dm.typing.stop", conversationId });
    }, TYPING_STOP_AFTER_MS);
  }, [conversationId]);

  const sendTypingStop = useCallback(() => {
    if (!conversationId) return;
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      getChatSocket().send({ type: "dm.typing.stop", conversationId });
    }
  }, [conversationId]);

  const upsertLocalMessage = useCallback((message: DmMessage) => {
    dispatch({ kind: "messageUpserted", message });
  }, []);

  return {
    messages: state.messages,
    loadingInitial: state.loadingInitial,
    loadingOlder: state.loadingOlder,
    hasMoreOlder: state.hasMoreOlder,
    loadError: state.loadError,
    connectionState: state.connectionState,
    typingUserIds: state.typingUserIds,
    loadOlderMessages,
    sendTypingStart,
    sendTypingStop,
    upsertLocalMessage,
  };
}
