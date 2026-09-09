"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { IconRail } from "@/components/rooms/IconRail";
import { Drawer } from "@/components/layout/Drawer";
import { RoomSidebarContext } from "@/lib/rooms/RoomSidebarContext";

/**
 * IconRail (layer 1) is the single outermost navigation element for every
 * /rooms/* route, including the empty /rooms index — it degrades to
 * room-switcher-only when no room-specific data has been provided via
 * ActiveModuleContext (see IconRail.tsx). Per the responsive spec, the
 * rail itself stays visible down to tablet width and only collapses into
 * a drawer on mobile (unlike the old full-width room list, which
 * collapsed earlier) — the contextual sub-sidebar (layer 2) is the one
 * that becomes a drawer at the tablet breakpoint instead, owned by each
 * room page individually since its contents depend on which room/module
 * is open.
 */
export default function RoomsLayout({ children }: { children: ReactNode }) {
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  return (
    <AppShell fillHeight>
      <RoomSidebarContext.Provider value={{ openMobileSidebar: () => setMobileRailOpen(true) }}>
        <div className="flex min-h-0 h-full flex-1">
          <div className="hidden sm:flex sm:shrink-0">
            <IconRail />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>

        <div className="sm:hidden">
          <Drawer side="left" open={mobileRailOpen} onClose={() => setMobileRailOpen(false)}>
            <IconRail />
          </Drawer>
        </div>
      </RoomSidebarContext.Provider>
    </AppShell>
  );
}
