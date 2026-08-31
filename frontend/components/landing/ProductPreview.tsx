"use client";

import { motion } from "motion/react";

const SIDEBAR_LINKS = [
  { label: "Home", active: true },
  { label: "Rooms" },
  { label: "Messages" },
  { label: "GitHub" },
  { label: "Activity" },
  { label: "People" },
  { label: "Settings" },
];

const STATS = [
  { label: "Rooms", value: "6" },
  { label: "Messages", value: "1,284" },
  { label: "Events", value: "42" },
];

const RECENT_ROOMS = [
  { name: "rocket-app", meta: "12 members · active now" },
  { name: "infra-tools", meta: "5 members · 3m ago" },
  { name: "design-system", meta: "8 members · 1h ago" },
];

export function ProductPreview() {
  return (
    <section id="preview" className="relative px-6 pb-28">
      <motion.div
        className="glass-panel relative mx-auto max-w-6xl overflow-hidden rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 font-mono text-xs text-muted-2">app.commit.ly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          <aside className="border-b border-border bg-background-2/60 p-4 sm:border-b-0 sm:border-r">
            <p className="mb-4 px-2 font-mono text-sm font-semibold tracking-tight text-foreground">
              commit<span className="text-accent">.ly</span>
            </p>
            <nav className="flex flex-col gap-0.5">
              {SIDEBAR_LINKS.map((link) => (
                <span
                  key={link.label}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    link.active
                      ? "bg-white/[0.06] font-medium text-foreground"
                      : "text-muted"
                  }`}
                >
                  {link.label}
                </span>
              ))}
            </nav>
          </aside>

          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Welcome back, Yash.
            </h3>
            <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening across your workspace.</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-background/40 px-4 py-3.5">
                  <p className="font-mono text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Recent rooms</p>
                <div className="space-y-2">
                  {RECENT_ROOMS.map((room) => (
                    <div
                      key={room.name}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3.5 py-2.5"
                    >
                      <span className="font-mono text-sm text-foreground">{room.name}</span>
                      <span className="text-xs text-muted-2">{room.meta}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Recent activity</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <p className="text-sm text-muted">
                      <span className="text-foreground">maya</span> opened PR #482 in rocket-app
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
                    <p className="text-sm text-muted">
                      <span className="text-foreground">devon</span> merged into main
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <p className="text-sm text-muted">CI passed on infra-tools</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
