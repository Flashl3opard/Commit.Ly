import { MODULE_ICONS, MODULE_LABELS } from "./IconRail";
import type { RoomModuleType } from "@/lib/api/rooms";

/**
 * Honest placeholder for modules whose main-content view isn't built yet
 * (Tasks/Notes/Releases have no backing data model beyond RoomModule
 * itself; GitHub Activity's real content today lives inline in Chat as
 * system messages, not as a standalone module view). Never fakes data —
 * just says plainly what exists and what doesn't, matching this
 * codebase's established rule against fake functionality.
 */
export function ModulePlaceholder({ moduleType }: { moduleType: RoomModuleType }) {
  const Icon = MODULE_ICONS[moduleType];
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-room-chat-bg px-6 text-center">
      <Icon className="h-8 w-8 text-muted-2" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{MODULE_LABELS[moduleType]}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        {moduleType === "GITHUB_ACTIVITY"
          ? "A dedicated GitHub Activity view isn't built yet — pushes, pull requests, and issues currently appear inline in Chat."
          : "This module is enabled for the room, but its dedicated view isn't built yet."}
      </p>
    </div>
  );
}
