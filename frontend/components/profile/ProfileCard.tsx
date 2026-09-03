import Link from "next/link";
import type { PrivateUser } from "@/lib/api/types";
import { UserAvatar } from "@/components/ui/UserAvatar";

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-xs text-accent">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      GitHub Verified
    </span>
  );
}

export function ProfileCard({ user }: { user: PrivateUser }) {
  const displayName = user.displayName ?? user.username;

  return (
    <div className="glass-panel rounded-2xl p-8">
      <div className="flex items-center gap-5">
        <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="xl" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{displayName}</h1>
            {user.githubVerified && <VerifiedBadge />}
          </div>
          <p className="text-sm text-muted-2">@{user.username}</p>
          <p className="mt-0.5 text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {user.bio && <p className="mt-6 text-sm leading-relaxed text-foreground">{user.bio}</p>}

      {(user.role || user.location) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {user.role && <span>{user.role}</span>}
          {user.role && user.location && <span aria-hidden="true">·</span>}
          {user.location && <span>{user.location}</span>}
        </div>
      )}

      {user.skills.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
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

      <div className="mt-6 border-t border-border pt-6">
        <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Custom status</p>
        <p className="mt-1.5 text-sm text-foreground">
          {user.customStatus ?? <span className="text-muted">No status set.</span>}
        </p>
      </div>

      <div className="mt-8">
        <Link
          href="/profile/edit"
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          Edit Profile
        </Link>
      </div>
    </div>
  );
}
