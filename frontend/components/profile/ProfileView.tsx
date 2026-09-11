import { ProfileHeader } from "./ProfileHeader";
import { ProfileStatsStrip } from "./ProfileStatsStrip";
import { SharedRoomsSection } from "./SharedRoomsSection";
import { GithubConnectionSection } from "./GithubConnectionSection";
import { GithubAppSection } from "./GithubAppSection";
import { FriendActionButton } from "./FriendActionButton";
import type { PrivateUser, PublicProfile } from "@/lib/api/types";

/**
 * Shared layout for both "my profile" (PrivateUser, own account controls)
 * and "someone else's profile" (PublicProfile, friend action + shared
 * rooms instead). A proper multi-section SAAS profile page rather than a
 * single cramped card: identity banner, stat strip, then either account
 * settings (own) or social context (others).
 */
export function ProfileView({ user, isOwnProfile }: { user: PrivateUser; isOwnProfile: true }): React.ReactElement;
export function ProfileView({ user, isOwnProfile }: { user: PublicProfile; isOwnProfile: false }): React.ReactElement;
export function ProfileView({
  user,
  isOwnProfile,
}: { user: PrivateUser; isOwnProfile: true } | { user: PublicProfile; isOwnProfile: false }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <ProfileHeader
        user={user}
        isOwnProfile={isOwnProfile}
        action={!isOwnProfile ? <FriendActionButton profile={user} /> : undefined}
      />

      <ProfileStatsStrip user={user} />

      {isOwnProfile ? (
        <div className="glass-panel space-y-4 rounded-2xl p-6">
          <GithubConnectionSection />
          <GithubAppSection />
        </div>
      ) : (
        <SharedRoomsSection userId={user.id} />
      )}
    </div>
  );
}
