"use client";

import { motion } from "motion/react";

const FEATURES = [
  {
    title: "Repo-native rooms",
    tagline: "Every workspace starts with a repository.",
    description:
      "No more guessing which channel a conversation belongs in. Commit.ly rooms map directly to the repositories your team already works in.",
  },
  {
    title: "Real-time collaboration",
    tagline: "Talk where the code lives.",
    description:
      "Discuss a pull request, debug an incident, or plan a release without leaving the context of the repository it concerns.",
  },
  {
    title: "GitHub activity",
    tagline: "PRs, issues and pushes become part of the conversation.",
    description:
      "Commits, pull requests and issues surface as first-class events inside the room — not a separate feed you have to check.",
  },
  {
    title: "Developer-first",
    tagline: "Built around how engineering teams actually work.",
    description:
      "Fast, keyboard-friendly, and free of the unrelated noise that generic chat tools bring into an engineering workflow.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative border-t border-border px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-xs tracking-wide text-accent uppercase">Why Commit.ly</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Built around the repository, not around another sidebar.
          </h2>
        </motion.div>

        <div className="mt-16 divide-y divide-border border-t border-border">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="grid grid-cols-1 gap-4 py-10 md:grid-cols-[220px_1fr_1fr] md:items-baseline md:gap-8"
            >
              <span className="font-mono text-sm text-muted-2">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {feature.title}
                <span className="block text-base font-normal text-accent">{feature.tagline}</span>
              </h3>
              <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
