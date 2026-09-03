"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

export function FinalCta() {
  const { status, user } = useAuth();
  const isAuthenticated = status === "authenticated" && Boolean(user);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section className="relative border-t border-border px-6 py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 460px at 50% 40%, rgba(52,55,160,0.14), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Your code has a home.
          <br />
          <span className="text-gradient">Your team should too.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted">
          Bring the repository, the people, and the conversation together.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={isAuthenticated ? "/" : "/signup"}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.02] sm:w-auto"
          >
            {isAuthenticated ? "Open Commit.ly" : "Create your workspace"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {!isAuthenticated && (
            <Link
              href="/login"
              className="focus-ring inline-flex w-full items-center justify-center rounded-lg border border-border-strong px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 sm:w-auto"
            >
              Sign in
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
}
