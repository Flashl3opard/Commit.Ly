"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <AppShell>
      {user && (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <ProfileCard user={user} />
        </main>
      )}
    </AppShell>
  );
}
