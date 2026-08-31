"use client";

import { motion } from "motion/react";

const STEPS = [
  {
    label: "01",
    title: "Connect repository",
    description: "Link a GitHub repository to start a new Commit.ly workspace.",
  },
  {
    label: "02",
    title: "Create workspace",
    description: "Your repo becomes a dedicated space for the team working on it.",
  },
  {
    label: "03",
    title: "Invite team",
    description: "Bring in the engineers, designers and reviewers who ship the code.",
  },
  {
    label: "04",
    title: "Build together",
    description: "Chat, review, and track activity — all in the same place as the code.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-border px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-mono text-xs tracking-wide text-accent uppercase">How it works</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            From repository to running workspace in minutes.
          </h2>
        </motion.div>

        <div className="relative mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="absolute top-6 right-0 left-0 hidden h-px bg-linear-to-r from-transparent via-border-strong to-transparent lg:block"
            aria-hidden="true"
          />
          {STEPS.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="relative"
            >
              <div className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-background-2 font-mono text-sm text-accent">
                {step.label}
              </div>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
