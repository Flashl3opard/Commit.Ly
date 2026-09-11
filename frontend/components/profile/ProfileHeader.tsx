import { Pencil } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { GithubVerifiedBadge } from "@/components/ui/GithubVerifiedBadge";
import type { PrivateUser, PublicProfile } from "@/lib/api/types";

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Large banner-style identity block — the top of both the own-profile and
 * viewing-others-profile pages. isOwnProfile swaps the trailing action
 * slot (Edit Profile link vs. whatever the caller passes as `action`,
 * e.g. FriendActionButton) without this component needing to know about
 * friends at all.
 */
export function ProfileHeader({
  user,
  isOwnProfile,
  action,
}: {
  user: PrivateUser | PublicProfile;
  isOwnProfile: boolean;
  action?: React.ReactNode;
}) {
  const displayName = user.displayName ?? user.username;

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 700px 300px at 20% 0%, var(--accent-soft), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
            {user.githubVerified && <GithubVerifiedBadge />}
          </div>
          <p className="mt-0.5 text-sm text-muted-2">@{user.username}</p>

          {user.customStatus && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background-2 px-3 py-1 text-xs text-foreground">
              {user.customStatus}
            </p>
          )}

          {user.bio && <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground">{user.bio}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {user.role && <span>{user.role}</span>}
            {user.role && user.location && <span aria-hidden="true">·</span>}
            {user.location && <span>{user.location}</span>}
            {(user.role || user.location) && <span aria-hidden="true">·</span>}
            <span>Joined {formatJoinDate(user.createdAt)}</span>
          </div>

          {user.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs text-accent"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 self-start sm:self-center">
          {isOwnProfile ? (
            <Link
              href="/profile/edit"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit Profile
            </Link>
          ) : (
            action
          )}
        </div>
      </div>
    </div>
  );
}
