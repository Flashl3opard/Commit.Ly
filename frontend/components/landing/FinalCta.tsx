"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function FinalCta() {
  return (
    <section className="relative border-t border-border px-6 py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 700px 400px at 50% 50%, rgba(34,211,238,0.06), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Your repository is already where the work happens.
          <br />
          <span className="text-gradient">Bring the team with it.</span>
        </h2>
        <Link
          href="/signup"
          className="focus-ring mt-10 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.02]"
        >
          Get Started
          <span aria-hidden="true">→</span>
        </Link>
      </motion.div>
    </section>
  );
}
