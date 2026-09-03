"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

/**
 * Redirects once auth (and, where relevant, onboarding) status resolves.
 * Pass null/omit a destination to not redirect for that case. Checked in
 * order: unauthenticated, then incomplete profile, then complete/authenticated
 * — so an incomplete profile is only ever pushed toward onboarding, and a
 * complete one is only ever pushed away from it.
 */
export function useRedirectByAuth({
  whenAuthenticated = null,
  whenUnauthenticated = null,
  whenIncompleteProfile = null,
  whenCompleteProfile = null,
}: {
  whenAuthenticated?: string | null;
  whenUnauthenticated?: string | null;
  whenIncompleteProfile?: string | null;
  whenCompleteProfile?: string | null;
}) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" && whenUnauthenticated) {
      router.replace(whenUnauthenticated);
      return;
    }

    if (status !== "authenticated" || !user) {
      return;
    }

    if (whenIncompleteProfile && !user.profileCompleted) {
      router.replace(whenIncompleteProfile);
      return;
    }

    if (whenCompleteProfile && user.profileCompleted) {
      router.replace(whenCompleteProfile);
      return;
    }

    if (whenAuthenticated) {
      router.replace(whenAuthenticated);
    }
  }, [status, user, whenAuthenticated, whenUnauthenticated, whenIncompleteProfile, whenCompleteProfile, router]);

  return { status };
}
