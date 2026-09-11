"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { IconRail } from "@/components/rooms/IconRail";
import { Drawer } from "./Drawer";
import { RoomSidebarContext } from "@/lib/rooms/RoomSidebarContext";

/**
 * Shared authenticated-route wrapper: redirects to /home when unauthenticated,
 * renders nothing while auth status is resolving, and provides the icon
 * rail (the single outermost navigation element for every logged-in page,
 * not just /rooms/*) once a user is available. The standalone top navbar
 * was removed — Rooms/Messages/GitHub/Activity/People lived only there,
 * and profile/notifications/DM entry points now live in the rail itself.
 *
 * `fillHeight` switches the outer container from `min-h-screen` (page grows
 * with content, e.g. profile/dashboard) to a fixed `h-screen` with the
 * content area set to `overflow-hidden` — needed by routes like /rooms that
 * manage their own internal scroll regions (sidebar + main pane) instead of
 * scrolling the whole page.
 */
export function AppShell({ children, fillHeight = false }: { children: ReactNode; fillHeight?: boolean }) {
  const { status } = useRedirectByAuth({
    whenUnauthenticated: "/home",
    whenIncompleteProfile: "/onboarding",
  });
  const { user } = useAuth();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  if (status === "loading" || status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <RoomSidebarContext.Provider value={{ openMobileSidebar: () => setMobileRailOpen(true) }}>
      <div className={`flex bg-background ${fillHeight ? "h-screen" : "min-h-screen"}`}>
        <div className="hidden sm:flex sm:shrink-0">
          <IconRail />
        </div>

        <div className="sm:hidden">
          <Drawer side="left" open={mobileRailOpen} onClose={() => setMobileRailOpen(false)}>
            <IconRail />
          </Drawer>
        </div>

        <div className={fillHeight ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1"}>{children}</div>
      </div>
    </RoomSidebarContext.Provider>
  );
}
