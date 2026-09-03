"use client";

import { motion } from "motion/react";
import {
  GitCommitHorizontal,
  GitPullRequest,
  CircleDot,
  MessageCircle,
  ArrowRight,
  GitBranch,
  Zap,
  FolderGit2,
  Activity,
  Circle,
  Users,
} from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

const STEPS = [
  { icon: GitCommitHorizontal, label: "Push", description: "Code lands on the branch." },
  { icon: GitPullRequest, label: "Pull request", description: "Work opens up for review." },
  { icon: CircleDot, label: "Review & issues", description: "Feedback and follow-ups surface." },
  { icon: MessageCircle, label: "Discussion", description: "The team talks it through, in context." },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: "GitHub-native",
    description: "Built around your repository, not bolted on top of it.",
  },
  {
    icon: Zap,
    title: "Real-time collaboration",
    description: "Conversations that keep pace with how fast code moves.",
  },
  {
    icon: FolderGit2,
    title: "Project-based rooms",
    description: "One workspace per repository — no guessing where things belong.",
  },
  {
    icon: Activity,
    title: "Development activity",
    description: "Pushes, PRs, and issues surface as part of the conversation.",
  },
  {
    icon: Circle,
    title: "Presence",
    description: "See who's around and actively working on what.",
  },
  {
    icon: Users,
    title: "Team context",
    description: "Everyone touching the codebase, in the same shared space.",
  },
];

export function PlatformSection() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section id="features" className="relative border-t border-border px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-xl text-center"
        >
          <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">The platform</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Code changes become conversation.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Commit.ly is built to bring GitHub activity into the same place your team
            already talks — designed for developers, designers, and everyone else
            shipping the work — so a push doesn&apos;t have to end in silence.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.label}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="relative flex flex-col items-center gap-3 rounded-xl border border-border bg-background-2/60 px-5 py-7 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent/[0.08] text-accent">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              <p className="text-xs leading-relaxed text-muted-2">{step.description}</p>

              {index < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute top-1/2 -right-3.5 hidden h-4 w-4 -translate-y-1/2 text-muted-2 lg:block"
                  aria-hidden="true"
                />
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="mt-24 text-center"
        >
          <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Built for the people shipping it</p>
          <h3 className="mx-auto mt-4 max-w-lg text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Not a generic team-management tool.
          </h3>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className="group rounded-xl border border-border bg-background-2/60 p-6 transition-colors hover:border-accent/25 hover:bg-background-3"
            >
              <feature.icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-2">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
