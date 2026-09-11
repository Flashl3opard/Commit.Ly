"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getRoom, type RoomDetails, type RoomModuleType } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";
import { errorStateCopyFor, type ErrorStateCopy } from "@/lib/api/errorState";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { RoomSettingsDialog } from "@/components/rooms/RoomSettingsDialog";
import { CustomizeRoomDialog } from "@/components/rooms/CustomizeRoomDialog";
import { ContextualSubSidebar } from "@/components/rooms/ContextualSubSidebar";
import { RoomChat } from "@/components/chat/RoomChat";
import { RoomMembersPanel } from "@/components/rooms/RoomMembersPanel";
import { ModulePlaceholder } from "@/components/rooms/ModulePlaceholder";
import { useCommandPalette } from "@/components/search/useCommandPalette";
import { CommandPalette } from "@/components/search/CommandPalette";
import { ErrorState } from "@/components/ui/ErrorState";
import { useLastVisitedRoom } from "@/lib/rooms/useLastVisitedRoom";
import { RoomModulesProvider, useRoomModules } from "@/lib/rooms/RoomModulesContext";
import { ActiveModuleProvider } from "@/lib/rooms/ActiveModuleContext";
import { useRoomChannels } from "@/lib/rooms/useRoomChannels";

type LoadState =
  | { status: "loading"; roomId: string }
  | { status: "ready"; roomId: string; room: RoomDetails }
  | { status: "not-found"; roomId: string }
  | { status: "forbidden"; roomId: string }
  | { status: "error"; roomId: string; copy: ErrorStateCopy };

export default function RoomDetailsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [load, setLoad] = useState<LoadState>({ status: "loading", roomId });
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getRoom(roomId)
      .then(({ room: fetched }) => {
        if (cancelled) return;
        setLoad({ status: "ready", roomId, room: fetched });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          // Room Service treats "not a member" and "doesn't exist" the same
          // way (both 404), so this page never distinguishes them either —
          // doing so would leak room existence to non-members.
          setLoad({ status: err.status === 403 ? "forbidden" : "not-found", roomId });
          return;
        }
        setLoad({
          status: "error",
          roomId,
          copy: errorStateCopyFor(err, "Check that Room Service is running, then try again."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // A render for a roomId that doesn't match the in-flight/loaded state
  // (i.e. the user navigated to a different room while this was still
  // resolving) is treated the same as "loading" rather than showing stale
  // content from the previous room.
  const current = load.roomId === roomId ? load : { status: "loading" as const, roomId };

  useLastVisitedRoom(current.status === "ready" ? current.room.id : null);

  if (current.status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading room…
        </div>
      </main>
    );
  }

  if (current.status === "not-found" || current.status === "forbidden") {
    return (
      <main className="flex flex-1 flex-col">
        <ErrorState
          title={current.status === "forbidden" ? "403 — Access denied." : "Room not found."}
          description="It may have been deleted, or you may need a room code to join."
          onBack={() => router.push("/rooms")}
        />
      </main>
    );
  }

  if (current.status === "error") {
    return (
      <main className="flex flex-1 flex-col">
        <ErrorState title={current.copy.title} description={current.copy.description} onRetry={() => window.location.reload()} />
      </main>
    );
  }

  return (
    <RoomModulesProvider roomId={current.room.id}>
      <RoomWorkspace room={current.room} />
    </RoomModulesProvider>
  );
}

/**
 * Split out from the page component so it can call useRoomModules() —
 * that hook requires the RoomModulesProvider mounted just above it, which
 * only exists once a room has actually loaded.
 */
function RoomWorkspace({ room }: { room: RoomDetails }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activeModuleType, setActiveModuleType] = useState<RoomModuleType>("CHAT");
  const commandPalette = useCommandPalette();
  const searchParams = useSearchParams();
  const initialOpenThreadId = searchParams.get("thread");
  const { modules, loading: modulesLoading, upsertModule, removeModuleLocal } = useRoomModules();
  const {
    channels,
    activeChannelId,
    activeChannel,
    loading: channelsLoading,
    selectChannel,
    onChannelCreated,
    onChannelUpdated,
    onChannelArchived,
  } = useRoomChannels(room.id);

  const isOwner = room.currentUserRole === "OWNER";

  return (
    <ActiveModuleProvider
      value={{
        modules,
        activeModuleType,
        onSelectModule: setActiveModuleType,
        onAddModule: isOwner ? () => setCustomizeOpen(true) : undefined,
        onOpenRoomSettings: () => setSettingsOpen(true),
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <RoomHeader
          room={room}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSearch={commandPalette.open}
          onToggleMembers={() => setMembersOpen((v) => !v)}
        />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {!modulesLoading && !channelsLoading && (
            <ContextualSubSidebar
              moduleType={activeModuleType}
              roomId={room.id}
              currentUserRole={room.currentUserRole}
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={selectChannel}
              onChannelCreated={onChannelCreated}
              onChannelUpdated={onChannelUpdated}
              onChannelArchived={onChannelArchived}
            />
          )}

          {activeModuleType === "CHAT" ? (
            activeChannel ? (
              <RoomChat
                room={room}
                channelId={activeChannel.id}
                channelName={activeChannel.name}
                membersOpen={membersOpen}
                onCloseMembers={() => setMembersOpen(false)}
                initialOpenThreadId={initialOpenThreadId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-2" aria-hidden="true" />
              </div>
            )
          ) : activeModuleType === "MEMBERS" ? (
            <div className="flex min-h-0 flex-1">
              <RoomMembersPanel members={room.members} />
            </div>
          ) : (
            <ModulePlaceholder moduleType={activeModuleType} />
          )}
        </div>

        <RoomSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} />
        <CustomizeRoomDialog
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          room={room}
          modules={modules}
          onModuleUpserted={upsertModule}
          onModuleRemoved={removeModuleLocal}
        />
        <CommandPalette
          isOpen={commandPalette.isOpen}
          onClose={commandPalette.close}
          currentRoom={{ id: room.id, repositoryId: room.repository.id, members: room.members }}
        />
      </div>
    </ActiveModuleProvider>
  );
}
