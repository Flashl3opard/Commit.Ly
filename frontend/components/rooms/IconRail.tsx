"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  MessageSquare,
  MessagesSquare,
  GitBranch,
  Users,
  CheckSquare,
  StickyNote,
  Rocket,
  Plus,
  Settings,
  LogIn,
  Bell,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { CommitlyMark } from "@/components/ui/CommitlyMark";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { useActiveModule } from "@/lib/rooms/ActiveModuleContext";
import { useIncomingFriendRequestCount } from "@/lib/friends/useIncomingFriendRequestCount";
import { useTheme } from "@/lib/theme/ThemeContext";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { JoinRoomDialog } from "./JoinRoomDialog";
import { RoomCreatedDialog } from "./RoomCreatedDialog";
import type { Room, RoomModuleType } from "@/lib/api/rooms";

const MODULE_ICONS: Record<RoomModuleType, typeof MessageSquare> = {
  CHAT: MessageSquare,
  GITHUB_ACTIVITY: GitBranch,
  MEMBERS: Users,
  TASKS: CheckSquare,
  NOTES: StickyNote,
  RELEASES: Rocket,
};

const MODULE_LABELS: Record<RoomModuleType, string> = {
  CHAT: "Chat",
  GITHUB_ACTIVITY: "GitHub Activity",
  MEMBERS: "Members",
  TASKS: "Tasks",
  NOTES: "Notes",
  RELEASES: "Releases",
};

export { MODULE_ICONS, MODULE_LABELS };

/**
 * Layer 1 of the room UI — a narrow, icon-only rail answering "what part
 * of the project am I in?" Room switching lives in a compact stack at the
 * top (Discord-server-list style) rather than a separate full-width
 * sidebar, per the product decision to make this the single outermost
 * navigation layer. Lives in the shared /rooms layout (rendered on every
 * room-scoped route, including the empty /rooms index), so the current
 * room's module data — only known to the room page currently being
 * viewed — arrives via ActiveModuleContext rather than props; the rail
 * degrades to room-switcher-only when that context is absent.
 */
export function IconRail() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { rooms, addRoom } = useRooms();
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = useActiveModule();
  const activeRoomId = pathname?.match(/^\/rooms\/([^/]+)/)?.[1];
  const modules = activeModule?.modules ?? [];
  const activeModuleType = activeModule?.activeModuleType ?? null;
  const isDmActive = pathname?.startsWith("/dm") ?? false;
  const incomingFriendRequestCount = useIncomingFriendRequestCount(Boolean(user));
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);

  async function handleLogout() {
    setProfileOpen(false);
    await logout();
    router.replace("/login");
  }

  function handleCreated(room: Room) {
    addRoom(room);
    setCreatedRoom(room);
    router.push(`/rooms/${room.id}`);
  }

  function handleJoined(room: Room) {
    addRoom(room);
    router.push(`/rooms/${room.id}`);
  }

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-room-sidebar-bg py-3">
      <Link
        href="/"
        title="Commit.ly"
        aria-label="Commit.ly home"
        className="focus-ring mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
      >
        <CommitlyMark className="h-6 w-6" />
      </Link>

      <RailIconButton label="Direct messages" active={isDmActive} onClick={() => router.push("/dm")}>
        <MessagesSquare className="h-4.5 w-4.5" aria-hidden="true" />
      </RailIconButton>

      <nav aria-label="Rooms" className="flex w-full flex-col items-center gap-1.5 border-t border-room-sidebar-active pt-3">
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          return (
            <RailIconButton
              key={room.id}
              label={room.name}
              active={isActive}
              onClick={() => router.push(`/rooms/${room.id}`)}
            >
              <span className="text-xs font-semibold uppercase">{room.name.slice(0, 2)}</span>
            </RailIconButton>
          );
        })}
        <RailIconButton label="Create room" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4.5 w-4.5" aria-hidden="true" />
        </RailIconButton>
        <RailIconButton label="Join room" onClick={() => setJoinOpen(true)}>
          <LogIn className="h-4.5 w-4.5" aria-hidden="true" />
        </RailIconButton>
      </nav>

      {activeRoomId && modules.length > 0 && (
        <>
          <div className="my-3 h-px w-8 bg-room-sidebar-active" aria-hidden="true" />
          <nav aria-label="Room sections" className="flex w-full flex-col items-center gap-1.5">
            {modules
              .filter((m) => m.enabled)
              .map((module_) => {
                const Icon = MODULE_ICONS[module_.type];
                return (
                  <RailIconButton
                    key={module_.id}
                    label={module_.name || MODULE_LABELS[module_.type]}
                    active={module_.type === activeModuleType}
                    onClick={() => activeModule?.onSelectModule(module_.type)}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </RailIconButton>
                );
              })}
          </nav>
        </>
      )}

      <div className="flex-1" />

      {activeModule?.onAddModule && (
        <RailIconButton label="Add module" onClick={activeModule.onAddModule}>
          <Plus className="h-4.5 w-4.5" aria-hidden="true" />
        </RailIconButton>
      )}

      {activeModule && (
        <RailIconButton label="Room settings" onClick={activeModule.onOpenRoomSettings}>
          <Settings className="h-4.5 w-4.5" aria-hidden="true" />
        </RailIconButton>
      )}

      <RailIconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
        {theme === "dark" ? <Sun className="h-4.5 w-4.5" aria-hidden="true" /> : <Moon className="h-4.5 w-4.5" aria-hidden="true" />}
      </RailIconButton>

      {user && (
        <Link
          href="/dm?tab=requests"
          title={incomingFriendRequestCount > 0 ? `${incomingFriendRequestCount} pending friend request${incomingFriendRequestCount === 1 ? "" : "s"}` : "Notifications"}
          aria-label="Notifications"
          className="focus-ring relative mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-room-sidebar-muted transition-colors hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
        >
          <Bell className="h-4.5 w-4.5" aria-hidden="true" />
          {incomingFriendRequestCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {incomingFriendRequestCount > 9 ? "9+" : incomingFriendRequestCount}
            </span>
          )}
        </Link>
      )}

      {user && (
        <button
          type="button"
          onClick={() => setProfileOpen((o) => !o)}
          title={user.username}
          aria-label="Profile menu"
          className="focus-ring mt-2 flex h-9 w-9 items-center justify-center rounded-full"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-room-sidebar-active object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-room-sidebar-active font-mono text-xs text-room-sidebar-fg">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
      )}

      {profileOpen && (
        <div
          role="menu"
          className="glass-panel absolute bottom-3 left-16 z-20 w-44 rounded-xl p-1.5 shadow-2xl"
          onMouseLeave={() => setProfileOpen(false)}
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setProfileOpen(false)}
            className="focus-ring block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover-surface"
          >
            Profile
          </Link>
          <Link
            href="/profile/edit"
            role="menuitem"
            onClick={() => setProfileOpen(false)}
            className="focus-ring block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover-surface"
          >
            Edit profile
          </Link>
          <div className="my-1 h-px bg-room-sidebar-active" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover-surface"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Logout
          </button>
        </div>
      )}

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
      <RoomCreatedDialog room={createdRoom} onClose={() => setCreatedRoom(null)} />
    </aside>
  );
}

function RailIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative flex w-full justify-center">
      {active && (
        <span
          className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "true" : undefined}
        className={`focus-ring flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
          active
            ? "bg-room-sidebar-active text-room-sidebar-fg"
            : "text-room-sidebar-muted hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-1/2 left-full z-30 ml-2 hidden -translate-y-1/2 rounded-md border border-border-strong bg-background-3 px-2 py-1 text-xs font-medium whitespace-nowrap text-foreground shadow-lg group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </div>
  );
}
