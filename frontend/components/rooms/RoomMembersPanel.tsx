import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoomOwnerMark } from "@/components/ui/RoomOwnerMark";
import { GithubVerifiedBadge } from "@/components/ui/GithubVerifiedBadge";
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

function MemberRow({ member, isOnline, showPresence }: { member: RoomMember; isOnline: boolean; showPresence: boolean }) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <div className="relative shrink-0">
        <UserAvatar avatarUrl={member.avatarUrl} username={member.username ?? "Commit.ly user"} size="sm" />
        {showPresence && (
          <span
            title={isOnline ? "Online" : "Offline"}
            aria-label={isOnline ? "Online" : "Offline"}
            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-room-panel-bg ${
              isOnline ? "bg-success" : "bg-muted-2"
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{member.displayName ?? member.username ?? "Unknown user"}</p>
        {member.customStatus ? (
          <p className="truncate text-xs text-muted-2">{member.customStatus}</p>
        ) : (
          member.username &&
          member.displayName && <p className="truncate text-xs text-muted-2">@{member.username}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {member.role === "OWNER" && <RoomOwnerMark />}
        {member.githubVerified && <GithubVerifiedBadge />}
      </div>
    </li>
  );
}

export function RoomMembersPanel({ members, onlineUserIds }: RoomMembersPanelProps) {
  const onlineCount = onlineUserIds ? members.filter((m) => onlineUserIds.has(m.userId)).length : null;

  return (
    <div className="min-h-0 w-full shrink-0 overflow-y-auto border-l border-border bg-room-panel-bg p-4 md:w-64">
      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">
        Members — {members.length}
        {onlineCount !== null && <span className="text-muted"> · {onlineCount} online</span>}
      </p>

      {onlineUserIds ? (
        <>
          {(() => {
            const online = members.filter((m) => onlineUserIds.has(m.userId));
            const offline = members.filter((m) => !onlineUserIds.has(m.userId));
            return (
              <>
                {online.length > 0 && (
                  <div className="mt-3">
                    <p className="px-2 text-[11px] font-semibold tracking-wide text-muted-2 uppercase">
                      Online — {online.length}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {online.map((member) => (
                        <MemberRow key={member.userId} member={member} isOnline showPresence />
                      ))}
                    </ul>
                  </div>
                )}
                {offline.length > 0 && (
                  <div className="mt-4">
                    <p className="px-2 text-[11px] font-semibold tracking-wide text-muted-2 uppercase">
                      Offline — {offline.length}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {offline.map((member) => (
                        <MemberRow key={member.userId} member={member} isOnline={false} showPresence />
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <ul className="mt-3 space-y-1">
          {members.map((member) => (
            <MemberRow key={member.userId} member={member} isOnline={false} showPresence={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
