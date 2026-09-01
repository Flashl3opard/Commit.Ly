"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AuthLayout({
  title,
  subtitle,
  children,
  side,
  sidePosition = "right",
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Optional supplementary panel shown alongside the form on wide screens. */
  side?: ReactNode;
  /** Which side the supplementary panel appears on. Defaults to right. */
  sidePosition?: "left" | "right";
}) {
  const form = (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="focus-ring inline-flex items-center gap-1.5 font-mono text-sm text-muted transition-colors hover:text-foreground"
          >
            <span aria-hidden="true">←</span> Back to Commit.ly
          </Link>
          <ThemeToggle />
        </div>

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
  );

  const sidePanel = side && (
    <div
      className={`relative hidden flex-1 items-center justify-center lg:flex ${
        sidePosition === "left" ? "border-r border-border" : "border-l border-border"
      }`}
    >
      {side}
    </div>
  );

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--auth-bg-gradient)" }}
        aria-hidden="true"
      />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      {sidePosition === "left" ? (
        <>
          {sidePanel}
          {form}
        </>
      ) : (
        <>
          {form}
          {sidePanel}
        </>
      )}
    </div>
  );
}
