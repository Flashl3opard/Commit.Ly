"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { ErrorState } from "@/components/ui/ErrorState";
import { getUserProfile } from "@/lib/api/users";
import { ApiError } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import type { PublicProfile } from "@/lib/api/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: PublicProfile }
  | { status: "not-found" }
  | { status: "error"; message: string };

type Action =
  | { kind: "loaded"; profile: PublicProfile }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

function reducer(_state: LoadState, action: Action): LoadState {
  switch (action.kind) {
    case "loaded":
      return { status: "ready", profile: action.profile };
    case "not-found":
      return { status: "not-found" };
    case "error":
      return { status: "error", message: action.message };
  }
}

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  return <UserProfilePageContent params={params} />;
}

function UserProfilePageContent({ params }: { params: Promise<{ userId: string }> }) {
  const [state, dispatch] = useReducer(reducer, { status: "loading" });
  const { user: currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    params.then(({ userId }) => {
      if (cancelled) return;

      // Viewing your own profile through this route just redirects to the
      // canonical /profile — that page already has the richer own-account
      // controls (GitHub connection/App sections) this route doesn't show.
      if (currentUser && userId === currentUser.id) {
        router.replace("/profile");
        return;
      }

      getUserProfile(userId)
        .then(({ user }) => {
          if (!cancelled) dispatch({ kind: "loaded", profile: user });
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) {
            dispatch({ kind: "not-found" });
          } else {
            dispatch({ kind: "error", message: "Couldn't load this profile. Please try again." });
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [params, currentUser, router]);

  return (
    <AppShell>
      {state.status === "loading" && (
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-2" aria-hidden="true" />
        </main>
      )}

      {state.status === "not-found" && (
        <main className="flex flex-1 flex-col">
          <ErrorState title="User not found" description="This profile doesn't exist or may have been removed." />
        </main>
      )}

      {state.status === "error" && (
        <main className="flex flex-1 flex-col">
          <ErrorState title="Something went wrong" description={state.message} onRetry={() => window.location.reload()} />
        </main>
      )}

      {state.status === "ready" && <ProfileView user={state.profile} isOwnProfile={false} />}
    </AppShell>
  );
}
