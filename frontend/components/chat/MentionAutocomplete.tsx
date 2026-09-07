import type { RoomMember } from "@/lib/api/rooms";
import { UserAvatar } from "@/components/ui/UserAvatar";

type MentionAutocompleteProps = {
  candidates: RoomMember[];
  activeIndex: number;
  onSelect: (member: RoomMember) => void;
};

/**
 * Floats directly above the composer textarea (positioned by the parent),
 * listing room members whose username/displayName matches the in-progress
 * @query. Selection only ever inserts a real member's username — the
 * server independently re-verifies membership when the message is sent,
 * so this list is a convenience, not a trust boundary.
 */
export function MentionAutocomplete({ candidates, activeIndex, onSelect }: MentionAutocompleteProps) {
  if (candidates.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention a member"
      className="glass-panel absolute bottom-full left-0 mb-1.5 max-h-48 w-64 overflow-y-auto rounded-lg p-1 shadow-2xl"
    >
      {candidates.map((member, index) => (
        <button
          key={member.userId}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          // Mousedown (not click) so this fires before the textarea's blur
          // handler would otherwise dismiss the list first.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(member);
          }}
          className={`focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
            index === activeIndex ? "bg-accent-soft text-foreground" : "text-muted hover:bg-background-3 hover:text-foreground"
          }`}
        >
          <UserAvatar avatarUrl={member.avatarUrl} username={member.username ?? "Commit.ly user"} size="sm" />
          <span className="min-w-0 flex-1 truncate">{member.displayName ?? member.username}</span>
          {member.displayName && member.username && (
            <span className="shrink-0 truncate text-xs text-muted-2">@{member.username}</span>
          )}
        </button>
      ))}
    </div>
  );
}
