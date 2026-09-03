"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { CommitlyMark } from "@/components/ui/CommitlyMark";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "GitHub", href: "#github" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status, user } = useAuth();
  const isAuthenticated = status === "authenticated" && Boolean(user);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 24);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50"
      style={{
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        backgroundColor: scrolled ? "rgba(11,15,20,0.75)" : "rgba(11,15,20,0)",
        borderBottomColor: scrolled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)",
        boxShadow: scrolled ? "0 12px 40px rgba(0,0,0,0.45)" : "0 0px 0px rgba(0,0,0,0)",
        backdropFilter: scrolled ? "blur(18px)" : "blur(0px)",
        transition: "background-color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, backdrop-filter 0.35s ease",
      }}
    >
      <div className="flex w-full items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
        <Link
          href="/home"
          className="focus-ring group flex items-center gap-2 rounded-md py-1 font-mono text-base font-semibold tracking-tight text-foreground"
        >
          <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <CommitlyMark className="h-5 w-5" />
          </span>
          commit<span className="text-accent">.ly</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="focus-ring group relative rounded-lg px-3.5 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
              <span className="absolute inset-x-3.5 -bottom-px h-px scale-x-0 bg-linear-to-r from-accent to-accent-2 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link
              href="/"
              className="focus-ring group inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.03]"
            >
              Open Commit.ly
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="focus-ring rounded-lg px-3.5 py-2 text-sm font-medium text-foreground/90 transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <span className="h-4 w-px bg-border" aria-hidden="true" />
              <Link
                href="/signup"
                className="focus-ring group inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-transform hover:scale-[1.03]"
              >
                Get started
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="focus-ring rounded-lg p-2 text-foreground md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5.5 w-5.5" aria-hidden="true" /> : <Menu className="h-5.5 w-5.5" aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="glass-panel absolute inset-x-4 top-full mt-2 rounded-2xl p-4 shadow-2xl md:hidden"
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
              {isAuthenticated ? (
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-2.5 text-center text-sm font-semibold text-accent-foreground"
                >
                  Open Commit.ly
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="focus-ring rounded-lg px-3 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-white/5"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-2.5 text-center text-sm font-semibold text-accent-foreground"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
