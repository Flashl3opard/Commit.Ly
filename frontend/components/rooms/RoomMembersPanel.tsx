import { ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { RoomMember } from "@/lib/api/rooms";

export function RoomMembersPanel({ members }: { members: RoomMember[] }) {
  return (
    <div className="w-full shrink-0 border-l border-border p-4 md:w-64">
      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">
        Members — {members.length}
      </p>
      <ul className="mt-3 space-y-1">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <UserAvatar
              avatarUrl={member.avatarUrl}
              username={member.username ?? "Commit.ly user"}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {member.displayName ?? member.username ?? "Unknown user"}
              </p>
              {member.username && member.displayName && (
                <p className="truncate text-xs text-muted-2">@{member.username}</p>
              )}
            </div>
            {member.role === "OWNER" && (
              <span
                title="Room owner"
                aria-label="Room owner"
                className="inline-flex shrink-0 items-center text-accent"
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
