"use client";

import { useCallback, useEffect, useReducer } from "react";
import { getChannels, type Channel } from "@/lib/api/rooms";

type State = {
  channels: Channel[];
  activeChannelId: string | null;
  loading: boolean;
};

type Action =
  | { kind: "reset" }
  | { kind: "loaded"; channels: Channel[] }
  | { kind: "selectChannel"; channelId: string }
  | { kind: "channelCreated"; channel: Channel }
  | { kind: "channelUpdated"; channel: Channel }
  | { kind: "channelArchived"; channelId: string };

const initialState: State = { channels: [], activeChannelId: null, loading: true };

function pickFallbackChannelId(channels: Channel[]): string | null {
  return channels.find((c) => c.isDefault)?.id ?? channels[0]?.id ?? null;
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "reset":
      return initialState;
    case "loaded": {
      // Preserve the current selection across a refetch if it's still
      // valid (e.g. a background refresh); otherwise fall back to
      // general/first, matching a fresh load's behavior.
      const stillValid = state.activeChannelId && action.channels.some((c) => c.id === state.activeChannelId);
      return {
        channels: action.channels,
        activeChannelId: stillValid ? state.activeChannelId : pickFallbackChannelId(action.channels),
        loading: false,
      };
    }
    case "selectChannel":
      return { ...state, activeChannelId: action.channelId };
    case "channelCreated":
      return { ...state, channels: [...state.channels, action.channel], activeChannelId: action.channel.id };
    case "channelUpdated":
      return { ...state, channels: state.channels.map((c) => (c.id === action.channel.id ? action.channel : c)) };
    case "channelArchived": {
      const remaining = state.channels.filter((c) => c.id !== action.channelId);
      return {
        ...state,
        channels: remaining,
        activeChannelId: state.activeChannelId === action.channelId ? pickFallbackChannelId(remaining) : state.activeChannelId,
      };
    }
  }
}

/**
 * Owns a room's channel list and which one is currently selected. A
 * single reducer (not several useState calls) for the same reason
 * RoomModulesContext and useChatRoom use one — the roomId-change reset
 * and the fetch-settle both dispatch from inside an effect, which trips
 * react-hooks/set-state-in-effect if done via plain useState setters.
 */
export function useRoomChannels(roomId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ kind: "reset" });
    let cancelled = false;

    getChannels(roomId).then(({ channels: fetched }) => {
      if (!cancelled) dispatch({ kind: "loaded", channels: fetched });
    });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const selectChannel = useCallback((channelId: string) => {
    dispatch({ kind: "selectChannel", channelId });
  }, []);

  const onChannelCreated = useCallback((channel: Channel) => {
    dispatch({ kind: "channelCreated", channel });
  }, []);

  const onChannelUpdated = useCallback((channel: Channel) => {
    dispatch({ kind: "channelUpdated", channel });
  }, []);

  const onChannelArchived = useCallback((channelId: string) => {
    dispatch({ kind: "channelArchived", channelId });
  }, []);

  return {
    channels: state.channels,
    activeChannelId: state.activeChannelId,
    activeChannel: state.channels.find((c) => c.id === state.activeChannelId) ?? null,
    loading: state.loading,
    selectChannel,
    onChannelCreated,
    onChannelUpdated,
    onChannelArchived,
  };
}
