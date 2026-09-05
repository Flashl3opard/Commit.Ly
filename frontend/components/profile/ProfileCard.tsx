import Link from "next/link";
import { Pencil } from "lucide-react";
import type { PrivateUser } from "@/lib/api/types";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { GithubVerifiedBadge } from "@/components/ui/GithubVerifiedBadge";
import { GithubConnectionSection } from "./GithubConnectionSection";
import { GithubAppSection } from "./GithubAppSection";

export function ProfileCard({ user }: { user: PrivateUser }) {
  const displayName = user.displayName ?? user.username;

  return (
    <div className="glass-panel rounded-2xl p-8">
      <div className="flex items-center gap-5">
        <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="xl" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{displayName}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-2">@{user.username}</p>
            {user.githubVerified && <GithubVerifiedBadge />}
          </div>
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

      <div className="mt-6 space-y-4">
        <GithubConnectionSection />
        <GithubAppSection />
      </div>

      <div className="mt-8">
        <Link
          href="/profile/edit"
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit Profile
        </Link>
      </div>
    </div>
  );
}
