"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { AppNavbar } from "./AppNavbar";

/**
 * Shared authenticated-route wrapper: redirects to /home when unauthenticated,
 * renders nothing while auth status is resolving, and provides the app navbar
 * once a user is available.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useRedirectByAuth({ whenUnauthenticated: "/home" });
  const { user } = useAuth();

  if (status === "loading" || status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppNavbar user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
