import type { RoomMember } from "@/lib/api/rooms";

function nameFor(member: RoomMember | undefined): string {
  return member?.displayName ?? member?.username ?? "Someone";
}

function typingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing`;
}

export function TypingIndicator({ typingUserIds, members }: { typingUserIds: Set<string>; members: RoomMember[] }) {
  if (typingUserIds.size === 0) return <div className="h-5" aria-hidden="true" />;

  const names = Array.from(typingUserIds).map((userId) => nameFor(members.find((m) => m.userId === userId)));

  return (
    <div className="flex h-5 items-center gap-1.5 px-4 text-xs text-muted-2" role="status" aria-live="polite">
      <span className="flex items-center gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2 [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2 [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2" />
      </span>
      {typingLabel(names)}
    </div>
  );
}
