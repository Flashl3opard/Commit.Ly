"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { PrivateUser } from "@/lib/api/types";

export function ProfileMenu({ user }: { user: PrivateUser }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    router.replace("/login");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring flex items-center gap-2.5 rounded-lg border border-border px-2 py-1.5 pr-3 transition-colors hover:bg-white/5"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-accent/30 to-accent-2/30 font-mono text-xs text-accent">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden text-sm font-medium text-foreground sm:inline">{user.username}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-2" strokeWidth={2} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="glass-panel absolute right-0 mt-2 w-52 rounded-xl p-1.5 shadow-2xl"
          >
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/5"
            >
              <User className="h-4 w-4 text-muted-2" aria-hidden="true" />
              Profile
            </Link>
            <Link
              href="/profile/edit"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/5"
            >
              <Settings className="h-4 w-4 text-muted-2" aria-hidden="true" />
              Settings
            </Link>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-bg disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
