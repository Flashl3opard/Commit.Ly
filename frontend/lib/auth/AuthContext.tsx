"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/api/users";
import { logout as logoutRequest } from "@/lib/api/auth";
import { setUnauthorizedHandler } from "@/lib/api/client";
import type { PrivateUser } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: PrivateUser | null;
  status: AuthStatus;
  refreshSession: () => Promise<PrivateUser | null>;
  setUser: (user: PrivateUser | null) => void;
  markAuthenticated: (user: PrivateUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PrivateUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshSession = useCallback(async () => {
    try {
      const { user: currentUser } = await getCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
      return currentUser;
    } catch {
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  // The only correct way to record a fresh login/signup: user and status
  // must update together in the same render. Setting user alone (leaving
  // status at whatever it was, typically "unauthenticated" pre-login) lets
  // a guard evaluated on the very next render — e.g. the destination page's
  // useRedirectByAuth right after router.replace() — see an authenticated
  // user but a stale unauthenticated status, and bounce them straight back.
  const markAuthenticated = useCallback((authenticatedUser: PrivateUser) => {
    setUser(authenticatedUser);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Even if the request fails, the local session is cleared below —
      // the next protected request (or /users/me on reload) is the real
      // source of truth for whether the cookie actually got cleared.
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  // Any protected request coming back 401 (e.g. an expired JWT mid-session)
  // clears session state the same way an expired bootstrap check would.
  // Redirecting away from protected pages stays the job of each page's own
  // useRedirectByAuth, so there's exactly one place that decides "go to
  // /login" — no competing redirect logic, no loop risk.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then(({ user: currentUser }) => {
        if (!cancelled) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, refreshSession, setUser, markAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
