"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_LINKS = [
  { label: "Docs", href: "#" },
  { label: "About", href: "#" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 24);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.div
        className="flex w-full max-w-5xl items-center justify-between rounded-2xl px-5 py-3"
        animate={{
          backgroundColor: scrolled ? "rgba(12,17,23,0.72)" : "rgba(12,17,23,0)",
          borderColor: scrolled ? "rgba(148,199,224,0.16)" : "rgba(148,199,224,0)",
          boxShadow: scrolled ? "0 12px 40px rgba(0,0,0,0.35)" : "0 0px 0px rgba(0,0,0,0)",
          backdropFilter: scrolled ? "blur(16px)" : "blur(0px)",
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ borderWidth: 1, borderStyle: "solid" }}
      >
        <Link href="/home" className="font-mono text-base font-semibold tracking-tight text-foreground">
          commit<span className="text-accent">.ly</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="focus-ring rounded-lg px-3.5 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.03]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="focus-ring rounded-lg p-2 text-foreground md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="glass-panel absolute inset-x-4 top-20 rounded-2xl p-4 shadow-2xl md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="focus-ring rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Link
                href="/login"
                className="focus-ring rounded-lg px-3 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-white/5"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-2.5 text-center text-sm font-semibold text-accent-foreground"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
