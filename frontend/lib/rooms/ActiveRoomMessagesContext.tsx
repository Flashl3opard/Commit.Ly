"use client";

import { createContext, useContext } from "react";

const ActiveRoomMessagesContext = createContext<{ roomId: string; messageIds: string[] } | null>(null);

export const ActiveRoomMessagesProvider = ActiveRoomMessagesContext.Provider;

export function useActiveRoomMessages(): { roomId: string; messageIds: string[] } | null {
  return useContext(ActiveRoomMessagesContext);
}
