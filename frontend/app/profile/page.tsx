"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return <AppShell>{user && <ProfileView user={user} isOwnProfile />}</AppShell>;
}
