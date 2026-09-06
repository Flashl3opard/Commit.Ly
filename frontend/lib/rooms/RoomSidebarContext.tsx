"use client";

import { createContext, useContext } from "react";

type RoomSidebarContextValue = {
  openMobileSidebar: () => void;
};

export const RoomSidebarContext = createContext<RoomSidebarContextValue | null>(null);

export function useRoomSidebarDrawer(): RoomSidebarContextValue {
  const context = useContext(RoomSidebarContext);
  if (!context) {
    throw new Error("useRoomSidebarDrawer must be used within RoomsLayout");
  }
  return context;
}
