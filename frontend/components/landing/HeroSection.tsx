"use client";

import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ColorBendsBackground } from "./ColorBendsBackground";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export function HeroSection() {
  const { status, user } = useAuth();
  const isAuthenticated = status === "authenticated" && Boolean(user);
  const prefersReducedMotion = usePrefersReducedMotion();

  function handleScrollToProduct(event: React.MouseEvent<HTMLAnchorElement>) {
    if (prefersReducedMotion) return;
    const target = document.getElementById("product");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const headlineWords = ["Where", "your", "codebase"];

  return (
    <section className="relative overflow-hidden pt-40 pb-32 sm:pt-48 sm:pb-40">
      <div className="absolute inset-0" aria-hidden="true">
        <ColorBendsBackground
          colors={["#22D3EE", "#3B82F6", "#7C3AED", "#0EA5E9"]}
          rotation={90}
          speed={0.12}
          scale={1.1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={0.6}
          parallax={0.35}
          noise={0.06}
          iterations={1}
          intensity={0.85}
          bandWidth={6}
          transparent={false}
          autoRotate={0}
        />
        {/* Keeps the brightest color activity from sitting directly behind
            the headline — content stays legible without flattening the effect. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 900px 560px at 50% 34%, rgba(5,7,10,0.74), transparent 62%), linear-gradient(180deg, rgba(5,7,10,0.55) 0%, rgba(5,7,10,0.1) 28%, rgba(5,7,10,0.9) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <h1
          className={`${displayFont.className} text-[2.75rem] leading-[1.04] font-semibold tracking-tight text-balance text-foreground sm:text-7xl md:text-[5.5rem]`}
        >
          <span className="block overflow-hidden pb-1">
            {headlineWords.map((word, i) => (
              <motion.span
                key={word}
                initial={prefersReducedMotion ? undefined : { y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 + i * 0.07 }}
                className="mr-[0.28em] inline-block last:mr-0"
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="block overflow-hidden pb-2">
            <motion.span
              initial={prefersReducedMotion ? undefined : { y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.34 }}
              className="text-gradient inline-block"
            >
              comes to life.
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
          className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-balance text-muted sm:text-lg"
        >
          Connect your repositories, conversations, and development activity in one
          workspace built for the people shipping it.
        </motion.p>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.65 }}
          className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={isAuthenticated ? "/" : "/signup"}
            className="focus-ring group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_36px_rgba(34,211,238,0.3)] transition-transform hover:scale-[1.02] sm:w-auto"
          >
            {isAuthenticated ? "Open Commit.ly" : "Get started"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <a
            href="#product"
            onClick={handleScrollToProduct}
            className="focus-ring group inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-strong px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 sm:w-auto"
          >
            See how it works
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
