import { GitBranch, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import type { PrivateUser, PublicProfile } from "@/lib/api/types";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background-2 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-3 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-2">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * LeetCode-style stat-strip visual weight, using the real GitHub-derived
 * data this product actually has today (verification status, linked
 * account, skill count) — never fabricated numbers like a fake "rank" or
 * "problems solved" this app has no backing data for.
 */
export function ProfileStatsStrip({ user }: { user: PrivateUser | PublicProfile }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        icon={user.githubVerified ? <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" /> : <ShieldX className="h-4.5 w-4.5" aria-hidden="true" />}
        label="GitHub"
        value={user.githubVerified ? "Verified" : "Not connected"}
      />
      <StatCard
        icon={<GitBranch className="h-4.5 w-4.5" aria-hidden="true" />}
        label="GitHub account"
        value={user.githubUsername ? `@${user.githubUsername}` : "Not linked"}
      />
      <StatCard
        icon={<Sparkles className="h-4.5 w-4.5" aria-hidden="true" />}
        label="Skills"
        value={user.skills.length > 0 ? `${user.skills.length} listed` : "None listed"}
      />
    </div>
  );
}
