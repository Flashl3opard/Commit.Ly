"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getMyRooms, type Room } from "@/lib/api/rooms";
import { useAuth } from "@/lib/auth/AuthContext";

type RoomsContextValue = {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
};

const RoomsContext = createContext<RoomsContextValue | null>(null);

/**
 * Holds the authenticated user's room list once per app session rather than
 * having every sidebar/page re-fetch GET /rooms independently. Mutations
 * (create/join/leave/delete) update local state directly instead of forcing
 * a full refetch, per the "don't call GET /rooms unnecessarily" requirement.
 */
export function RoomsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const fetchedForSession = useRef(false);

  const refresh = useCallback(async () => {
    setFetchState("loading");
    setError(null);
    try {
      const { rooms: fetched } = await getMyRooms();
      setRooms(fetched);
    } catch {
      setError("Couldn't load your rooms. Check that Room Service is running.");
    } finally {
      setFetchState("done");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !fetchedForSession.current) {
      fetchedForSession.current = true;
      refresh();
    }
    if (status === "unauthenticated") {
      fetchedForSession.current = false;
    }
  }, [status, refresh]);

  const addRoom = useCallback((room: Room) => {
    setRooms((prev) => [room, ...prev]);
  }, []);

  const removeRoom = useCallback((roomId: string) => {
    setRooms((prev) => prev.filter((room) => room.id !== roomId));
  }, []);

  // Derived rather than synced via effect: an unauthenticated session has no
  // rooms and nothing in flight, regardless of what the last fetch left behind.
  // "idle" while authenticated still counts as loading — the fetch effect
  // hasn't run yet on this render, not "there are no rooms".
  const isUnauthenticated = status === "unauthenticated";
  const visibleRooms = isUnauthenticated ? [] : rooms;
  const loading = !isUnauthenticated && fetchState !== "done";

  return (
    <RoomsContext.Provider value={{ rooms: visibleRooms, loading, error, refresh, addRoom, removeRoom }}>
      {children}
    </RoomsContext.Provider>
  );
}

export function useRooms(): RoomsContextValue {
  const context = useContext(RoomsContext);
  if (!context) {
    throw new Error("useRooms must be used within a RoomsProvider");
  }
  return context;
}
