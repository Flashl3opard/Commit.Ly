"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FolderGit2, Plus, LogIn, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { CreateRoomDialog } from "@/components/rooms/CreateRoomDialog";
import { JoinRoomDialog } from "@/components/rooms/JoinRoomDialog";
import { RoomCreatedDialog } from "@/components/rooms/RoomCreatedDialog";
import type { Room } from "@/lib/api/rooms";

export default function DashboardPage() {
  const { user } = useAuth();
  const { rooms, loading, addRoom } = useRooms();
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);

  const stats = [
    { label: "Rooms", value: String(rooms.length) },
    { label: "Messages", value: "0" },
    { label: "GitHub Events", value: "0" },
  ];

  function handleCreated(room: Room) {
    addRoom(room);
    setCreatedRoom(room);
  }

  function handleJoined(room: Room) {
    addRoom(room);
    router.push(`/rooms/${room.id}`);
  }

  return (
    <AppShell>
      {user && (
        <main className="mx-auto max-w-6xl px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.06 }}
                  className="glass-panel rounded-xl px-5 py-4"
                >
                  <p className="font-mono text-2xl font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-0.5 text-sm text-muted">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="glass-panel rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-muted-2 uppercase">
                    Recent Rooms
                  </h2>
                  {rooms.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setJoinOpen(true)}
                        title="Join room"
                        aria-label="Join room"
                        className="focus-ring rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        title="Create room"
                        aria-label="Create room"
                        className="focus-ring rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading rooms…
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                    <p className="text-sm font-medium text-foreground">No rooms yet</p>
                    <p className="mt-1 max-w-55 text-sm text-muted">
                      Create or join a room to get started.
                    </p>
                    <div className="mt-5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Create Room
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinOpen(true)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
                      >
                        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                        Join Room
                      </button>
                    </div>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-1">
                    {rooms.slice(0, 5).map((room) => (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/rooms/${room.id}`)}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/[0.04]"
                        >
                          <FolderGit2 className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{room.name}</span>
                          <span className="shrink-0 truncate text-xs text-muted-2">
                            {room.repository.fullName}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glass-panel rounded-xl p-6">
                <h2 className="text-sm font-semibold tracking-wide text-muted-2 uppercase">
                  Recent Activity
                </h2>
                <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm font-medium text-foreground">No recent activity</p>
                  <p className="mt-1 max-w-60 text-sm text-muted">
                    Your GitHub and team activity will appear here.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      )}

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
      <RoomCreatedDialog room={createdRoom} onClose={() => setCreatedRoom(null)} />
    </AppShell>
  );
}
