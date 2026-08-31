import Link from "next/link";
import type { PrivateUser } from "@/lib/api/types";

export function ProfileCard({ user }: { user: PrivateUser }) {
  return (
    <div className="glass-panel rounded-2xl p-8">
      <div className="flex items-center gap-5">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={`${user.username}'s avatar`}
            className="h-18 w-18 rounded-full border border-border-strong object-cover"
          />
        ) : (
          <div className="flex h-18 w-18 items-center justify-center rounded-full border border-border-strong bg-linear-to-br from-accent/20 to-accent-2/20 font-mono text-2xl text-accent">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{user.username}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

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
