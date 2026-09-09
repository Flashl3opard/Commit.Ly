"use client";

import { createContext, useContext } from "react";
import type { RoomModule, RoomModuleType } from "@/lib/api/rooms";

type ActiveModuleContextValue = {
  modules: RoomModule[];
  activeModuleType: RoomModuleType | null;
  onSelectModule: (type: RoomModuleType) => void;
  onAddModule?: () => void;
  onOpenRoomSettings: () => void;
};

/**
 * Bridges the room page's module state up to IconRail, which lives in the
 * shared /rooms layout (one level above any given room page) and therefore
 * has no direct prop path to a specific room's data. Only populated while
 * viewing a room; IconRail falls back to its room-switcher-only rendering
 * when this context is absent (e.g. on the empty /rooms index).
 */
const ActiveModuleContext = createContext<ActiveModuleContextValue | null>(null);

export function ActiveModuleProvider({
  value,
  children,
}: {
  value: ActiveModuleContextValue;
  children: React.ReactNode;
}) {
  return <ActiveModuleContext.Provider value={value}>{children}</ActiveModuleContext.Provider>;
}

/** Returns null (not a throw) outside a room page — IconRail treats that as "no room selected." */
export function useActiveModule(): ActiveModuleContextValue | null {
  return useContext(ActiveModuleContext);
}
