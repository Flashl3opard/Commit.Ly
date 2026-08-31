"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

/**
 * Redirects once auth status resolves.
 * whenAuthenticated / whenUnauthenticated are the destinations to send the
 * user to; pass null to not redirect for that state.
 */
export function useRedirectByAuth({
  whenAuthenticated = null,
  whenUnauthenticated = null,
}: {
  whenAuthenticated?: string | null;
  whenUnauthenticated?: string | null;
}) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && whenAuthenticated) {
      router.replace(whenAuthenticated);
    } else if (status === "unauthenticated" && whenUnauthenticated) {
      router.replace(whenUnauthenticated);
    }
  }, [status, whenAuthenticated, whenUnauthenticated, router]);

  return { status };
}
