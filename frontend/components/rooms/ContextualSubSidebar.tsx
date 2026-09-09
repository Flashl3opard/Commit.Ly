"use client";

import { useState } from "react";
import { Hash, Plus, MoreHorizontal, Archive, Pencil, Loader2 } from "lucide-react";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { archiveChannel, updateChannel, type Channel, type RoomModuleType, type RoomRole } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";

type ContextualSubSidebarProps = {
  moduleType: RoomModuleType;
  roomId: string;
  currentUserRole: RoomRole;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onChannelCreated: (channel: Channel) => void;
  onChannelUpdated: (channel: Channel) => void;
  onChannelArchived: (channelId: string) => void;
};

/**
 * Layer 2 — the contextual sub-sidebar, answering "what channel/context am
 * I looking at?" Its contents depend entirely on which module the icon
 * rail has selected; only Chat has real backing data (channels) today, so
 * every other module gets a small static placeholder list per the spec's
 * mockup rather than duplicating the whole app's navigation here.
 */
export function ContextualSubSidebar({
  moduleType,
  roomId,
  currentUserRole,
  channels,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  onChannelUpdated,
  onChannelArchived,
}: ContextualSubSidebarProps) {
  if (moduleType === "CHAT") {
    return (
      <ChatChannelList
        roomId={roomId}
        currentUserRole={currentUserRole}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={onSelectChannel}
        onChannelCreated={onChannelCreated}
        onChannelUpdated={onChannelUpdated}
        onChannelArchived={onChannelArchived}
      />
    );
  }

  return <StaticSectionList moduleType={moduleType} />;
}

const STATIC_SECTIONS: Partial<Record<RoomModuleType, string[]>> = {
  GITHUB_ACTIVITY: ["Overview", "Pull Requests", "Issues", "Commits", "Releases"],
  TASKS: ["All Tasks", "My Tasks", "Backlog", "In Progress", "Completed"],
  NOTES: ["All Notes"],
  RELEASES: ["All Releases"],
};

const MODULE_HEADER_LABEL: Record<RoomModuleType, string> = {
  CHAT: "Chat",
  GITHUB_ACTIVITY: "GitHub",
  MEMBERS: "Members",
  TASKS: "Tasks",
  NOTES: "Notes",
  RELEASES: "Releases",
};

function StaticSectionList({ moduleType }: { moduleType: RoomModuleType }) {
  const sections = STATIC_SECTIONS[moduleType] ?? [];
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-room-sidebar-bg">
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-room-sidebar-muted-2 uppercase">
          {MODULE_HEADER_LABEL[moduleType]}
        </h2>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {sections.map((label) => (
          <li key={label}>
            <span className="block rounded-lg px-2.5 py-1.5 text-sm text-room-sidebar-muted">{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ChatChannelList({
  roomId,
  currentUserRole,
  channels,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  onChannelUpdated,
  onChannelArchived,
}: Omit<ContextualSubSidebarProps, "moduleType">) {
  const [createOpen, setCreateOpen] = useState(false);
  const isOwner = currentUserRole === "OWNER";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-room-sidebar-bg">
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-room-sidebar-muted-2 uppercase">Channels</h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title="Create channel"
            aria-label="Create channel"
            className="focus-ring rounded-lg p-1.5 text-room-sidebar-muted-2 transition-colors hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {channels.map((channel) => (
          <ChannelRow
            key={channel.id}
            roomId={roomId}
            channel={channel}
            isActive={channel.id === activeChannelId}
            isOwner={isOwner}
            onSelect={() => onSelectChannel(channel.id)}
            onUpdated={onChannelUpdated}
            onArchived={onChannelArchived}
          />
        ))}
      </ul>

      <CreateChannelDialog
        open={createOpen}
        roomId={roomId}
        onClose={() => setCreateOpen(false)}
        onCreated={(channel) => {
          onChannelCreated(channel);
          setCreateOpen(false);
        }}
      />
    </aside>
  );
}

function ChannelRow({
  roomId,
  channel,
  isActive,
  isOwner,
  onSelect,
  onUpdated,
  onArchived,
}: {
  roomId: string;
  channel: Channel;
  isActive: boolean;
  isOwner: boolean;
  onSelect: () => void;
  onUpdated: (channel: Channel) => void;
  onArchived: (channelId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(channel.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRenameSubmit() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === channel.name) {
      setRenaming(false);
      setDraftName(channel.name);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { channel: updated } = await updateChannel(roomId, channel.id, { name: trimmed });
      onUpdated(updated);
      setRenaming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename channel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    setError(null);
    try {
      await archiveChannel(roomId, channel.id);
      onArchived(channel.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't archive channel.");
      setBusy(false);
    }
  }

  if (renaming) {
    return (
      <li className="px-1 py-0.5">
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") {
              setRenaming(false);
              setDraftName(channel.name);
            }
          }}
          onBlur={handleRenameSubmit}
          disabled={busy}
          className="focus-ring w-full rounded-md border border-room-sidebar-active bg-room-sidebar-bg px-2 py-1 text-sm text-room-sidebar-fg"
        />
        {error && <p className="mt-1 px-1 text-xs text-danger">{error}</p>}
      </li>
    );
  }

  return (
    <li className="group/row relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? "page" : undefined}
        className={`focus-ring flex w-full items-center gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-left text-sm transition-colors ${
          isActive
            ? "bg-room-sidebar-active text-room-sidebar-fg"
            : "text-room-sidebar-muted hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
        }`}
      >
        <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-accent" : "text-room-sidebar-muted-2"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
      </button>

      {isOwner && !channel.isDefault && (
        <div className="absolute top-1/2 right-1 -translate-y-1/2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            title="Channel actions"
            aria-label="Channel actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`focus-ring rounded-md p-1 text-room-sidebar-muted-2 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-room-sidebar-active hover:text-room-sidebar-fg ${
              menuOpen ? "opacity-100" : ""
            }`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="glass-panel absolute top-full right-0 z-20 mt-1 w-36 rounded-lg p-1 shadow-2xl"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
                className="focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-white/5"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleArchive();
                }}
                className="focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-bg"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Archive
              </button>
            </div>
          )}
          {error && !renaming && <p className="absolute top-full right-0 mt-1 w-40 text-xs text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}
