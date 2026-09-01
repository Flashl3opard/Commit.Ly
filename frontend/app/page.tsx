"use client";

import { motion } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";

const STATS = [
  { label: "Rooms", value: "0" },
  { label: "Messages", value: "0" },
  { label: "GitHub Events", value: "0" },
];

export default function DashboardPage() {
  const { user } = useAuth();

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
              {STATS.map((stat, index) => (
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
                </div>
                <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm font-medium text-foreground">No rooms yet</p>
                  <p className="mt-1 max-w-55 text-sm text-muted">
                    Create or join a room to get started.
                  </p>
                  <button
                    type="button"
                    className="focus-ring mt-5 inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
                  >
                    + Create Room
                  </button>
                </div>
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
    </AppShell>
  );
}
