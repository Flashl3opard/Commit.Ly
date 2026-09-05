"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { AppNavbar } from "./AppNavbar";

/**
 * Shared authenticated-route wrapper: redirects to /home when unauthenticated,
 * renders nothing while auth status is resolving, and provides the app navbar
 * once a user is available.
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

  if (status === "loading" || status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <div className={`flex flex-1 flex-col bg-background ${fillHeight ? "h-screen" : "min-h-screen"}`}>
      <AppNavbar user={user} />
      <div className={fillHeight ? "flex-1 overflow-hidden" : "flex-1"}>{children}</div>
    </div>
  );
}
