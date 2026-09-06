import type { RoomMember } from "@/lib/api/rooms";

function nameFor(member: RoomMember | undefined): string {
  return member?.displayName ?? member?.username ?? "Someone";
}

function typingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing…`;
}

export function TypingIndicator({ typingUserIds, members }: { typingUserIds: Set<string>; members: RoomMember[] }) {
  if (typingUserIds.size === 0) return null;

  const names = Array.from(typingUserIds).map((userId) => nameFor(members.find((m) => m.userId === userId)));

  return (
    <div className="flex h-5 items-center px-4 text-xs text-muted-2" role="status" aria-live="polite">
      {typingLabel(names)}
    </div>
  );
}
