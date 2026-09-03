"use client";

import { motion } from "motion/react";
import { FolderGit2, MessageCircle, CircleDot, Code2, Users } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

const SCATTERED = [
  { icon: FolderGit2, label: "Repository" },
  { icon: MessageCircle, label: "Chat app" },
  { icon: CircleDot, label: "Issue tracker" },
];

const NODES = [
  { icon: GithubIcon, label: "GitHub repository", sub: "Source of development activity" },
  { icon: Code2, label: "Commit.ly", sub: "Where the team experiences it" },
  { icon: Users, label: "Team + conversation", sub: "People shipping the work" },
];

export function WhyCommitly() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section id="product" className="relative border-t border-border px-6 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-8">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Why Commit.ly</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Your repository is the workspace.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            A project shouldn&apos;t be scattered across a repository, a chat app, an issue
            tracker, and a thread of screenshots. Commit.ly is designed to bring
            collaboration back to the project itself.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {SCATTERED.map((item, index) => (
              <span key={item.label} className="flex items-center gap-3">
                <span className="flex items-center gap-2 rounded-full border border-border bg-background-2/60 px-4 py-2 text-sm text-muted-2">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </span>
                {index < SCATTERED.length - 1 && (
                  <span className="text-muted-2" aria-hidden="true">
                    +
                  </span>
                )}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          id="github"
          className="flex flex-col items-center lg:items-end"
        >
          <div className="w-full max-w-sm">
            <p className="text-center font-mono text-xs tracking-[0.18em] text-accent uppercase lg:text-right">
              GitHub, at the center
            </p>
            <h3 className="mt-3 text-center text-xl font-semibold tracking-tight text-balance text-foreground lg:text-right">
              GitHub is where the work happens.
              <br />
              Commit.ly is where the team lives in it.
            </h3>

            <div className="relative mt-10 flex flex-col items-center">
              {NODES.map((node, index) => (
                <div key={node.label} className="flex w-full flex-col items-center">
                  <motion.div
                    initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: index * 0.12 }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background-2/60 px-6 py-4 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/[0.08]">
                      <node.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{node.label}</p>
                      <p className="mt-0.5 text-xs text-muted-2">{node.sub}</p>
                    </div>
                  </motion.div>

                  {index < NODES.length - 1 && (
                    <motion.div
                      initial={prefersReducedMotion ? undefined : { scaleY: 0, opacity: 0 }}
                      whileInView={{ scaleY: 1, opacity: 1 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.35, delay: index * 0.12 + 0.15 }}
                      className="my-1 h-7 w-px origin-top bg-linear-to-b from-accent/50 to-accent-2/50"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
