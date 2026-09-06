import { ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { RoomMember } from "@/lib/api/rooms";

type RoomMembersPanelProps = {
  members: RoomMember[];
  /**
   * Realtime presence layered on top of actual room membership — a member
   * missing from this set is simply not currently connected, not removed
   * from the room. Membership itself always comes from Room Service
   * (the `members` prop), never from presence.
   */
  onlineUserIds?: Set<string>;
};

export function RoomMembersPanel({ members, onlineUserIds }: RoomMembersPanelProps) {
  const sortedMembers = onlineUserIds
    ? [...members].sort((a, b) => Number(onlineUserIds.has(b.userId)) - Number(onlineUserIds.has(a.userId)))
    : members;
  const onlineCount = onlineUserIds ? members.filter((m) => onlineUserIds.has(m.userId)).length : null;

  return (
    <div className="w-full shrink-0 border-l border-border p-4 md:w-64">
      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">
        Members — {members.length}
        {onlineCount !== null && <span className="text-muted"> · {onlineCount} online</span>}
      </p>
      <ul className="mt-3 space-y-1">
        {sortedMembers.map((member) => {
          const isOnline = onlineUserIds?.has(member.userId) ?? false;
          return (
            <li key={member.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <div className="relative shrink-0">
                <UserAvatar
                  avatarUrl={member.avatarUrl}
                  username={member.username ?? "Commit.ly user"}
                  size="sm"
                />
                {onlineUserIds && (
                  <span
                    title={isOnline ? "Online" : "Offline"}
                    aria-label={isOnline ? "Online" : "Offline"}
                    className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-background-2 ${
                      isOnline ? "bg-success" : "bg-muted-2"
                    }`}
                  />
                )}
              </div>
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
          );
        })}
      </ul>
    </div>
  );
}
