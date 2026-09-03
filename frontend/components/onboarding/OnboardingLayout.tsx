"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

const STEP_LABELS = ["Identity", "About", "Skills", "GitHub", "Review"];

export function OnboardingLayout({
  step,
  children,
  preview,
}: {
  step: number;
  children: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex-1 overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--auth-bg-gradient)" }}
        aria-hidden="true"
      />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
            commit<span className="text-accent">.ly</span>
          </span>
        </div>

        <nav aria-label="Onboarding progress" className="mt-8 flex items-center">
          {STEP_LABELS.map((label, index) => {
            const isComplete = index < step;
            const isCurrent = index === step;
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs transition-colors ${
                      isCurrent
                        ? "border-accent bg-accent/10 text-accent"
                        : isComplete
                          ? "border-accent/60 bg-accent/5 text-accent"
                          : "border-border text-muted-2"
                    }`}
                  >
                    {isComplete ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </div>
                  <span
                    className={`hidden font-mono text-[11px] tracking-wide uppercase sm:block ${
                      isCurrent ? "text-foreground" : "text-muted-2"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < STEP_LABELS.length - 1 && (
                  <div className="mx-2 h-px flex-1 bg-border">
                    <motion.div
                      className="h-px bg-accent"
                      initial={false}
                      animate={{ width: isComplete ? "100%" : "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="glass-panel rounded-2xl p-8 shadow-2xl"
          >
            {children}
          </motion.div>

          <div className="lg:sticky lg:top-16">{preview}</div>
        </div>
      </div>
    </div>
  );
}
