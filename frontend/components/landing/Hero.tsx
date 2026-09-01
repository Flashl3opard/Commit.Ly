"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ParallaxBackground } from "./ParallaxBackground";
import { FloatingRepoCard } from "./FloatingRepoCard";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-40 pb-28 sm:pt-48 sm:pb-36">
      <ParallaxBackground />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <motion.div
            className="max-w-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1 font-mono text-xs text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Repo-native collaboration
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl md:text-6xl">
              Your GitHub repo.
              <br />
              Your team.
              <br />
              <span className="text-gradient">Your flow.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Commit.ly brings your GitHub repository, team conversations and
              development activity together in one workspace.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-6 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.02]"
              >
                Get Started
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/login"
                className="focus-ring inline-flex items-center justify-center rounded-lg border border-border-strong px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
              >
                Sign In
              </Link>
            </div>
          </motion.div>

          <div className="relative hidden h-[420px] lg:block" aria-hidden="true">
            <FloatingRepoCard className="absolute top-0 right-0 w-56" depth={0.28} floatDelay={0}>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-foreground">rocket-app</span>
                <span className="text-muted-2">· main</span>
              </div>
              <div className="mt-2 flex gap-3 font-mono text-[11px] text-muted">
                <span className="text-accent">★ 128</span>
                <span>forks 24</span>
                <span>8 open PRs</span>
              </div>
            </FloatingRepoCard>

            <FloatingRepoCard className="absolute top-36 right-16 w-52" depth={0.24} floatDelay={0.3}>
              <div className="font-mono text-xs">
                <span className="text-accent">PR #42</span>
                <span className="ml-1.5 text-foreground">Fix auth middleware</span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted-2">
                feature/auth → main <span className="text-success">· Open</span>
              </div>
            </FloatingRepoCard>

            <FloatingRepoCard className="absolute top-64 right-0 w-48" depth={0.3} floatDelay={0.6}>
              <p className="text-xs leading-relaxed text-foreground">
                &ldquo;Looks good! Let&apos;s ship it 🚀&rdquo;
              </p>
              <p className="mt-1.5 font-mono text-[11px] text-muted-2">— devon</p>
            </FloatingRepoCard>

            <FloatingRepoCard className="absolute bottom-0 right-28 w-52" depth={0.22} floatDelay={0.9}>
              <p className="font-mono text-[11px] text-muted">
                You pushed <span className="text-accent">3 commits</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-2">2m ago</p>
            </FloatingRepoCard>
          </div>
        </div>
      </div>
    </section>
  );
}
