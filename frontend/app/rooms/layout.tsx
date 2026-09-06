"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoomSidebar } from "@/components/rooms/RoomSidebar";
import { Drawer } from "@/components/layout/Drawer";
import { RoomSidebarContext } from "@/lib/rooms/RoomSidebarContext";

export default function RoomsLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <AppShell fillHeight>
      <RoomSidebarContext.Provider value={{ openMobileSidebar: () => setMobileSidebarOpen(true) }}>
        <div className="flex min-h-0 h-full flex-1 flex-col md:flex-row">
          <div className="hidden md:flex md:shrink-0">
            <RoomSidebar />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>

        <div className="md:hidden">
          <Drawer side="left" open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}>
            <RoomSidebar />
          </Drawer>
        </div>
      </RoomSidebarContext.Provider>
    </AppShell>
  );
}
