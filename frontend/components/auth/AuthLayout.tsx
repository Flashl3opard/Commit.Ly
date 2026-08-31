"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";

export function AuthLayout({
  title,
  subtitle,
  children,
  side,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Optional supplementary panel shown alongside the form on wide screens. */
  side?: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 30% 20%, rgba(34,211,238,0.09), transparent 60%), radial-gradient(ellipse 600px 500px at 90% 80%, rgba(59,130,246,0.07), transparent 60%), linear-gradient(180deg, #06080b, #0c1117)",
        }}
        aria-hidden="true"
      />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative flex flex-1 items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <Link
            href="/home"
            className="focus-ring inline-flex items-center gap-1.5 font-mono text-sm text-muted transition-colors hover:text-foreground"
          >
            <span aria-hidden="true">←</span> Back to Commit.ly
          </Link>

          <div className="glass-panel mt-6 rounded-2xl p-8 shadow-2xl">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
              commit<span className="text-accent">.ly</span>
            </span>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>

            {children}
          </div>
        </motion.div>
      </div>

      {side && (
        <div className="relative hidden flex-1 items-center justify-center border-l border-border lg:flex">
          {side}
        </div>
      )}
    </div>
  );
}
