"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useCommandPalette } from "@/components/search/useCommandPalette";
import { CommandPalette } from "@/components/search/CommandPalette";
import type { PrivateUser } from "@/lib/api/types";

const APP_LINKS = [
  { label: "Home", href: "/" },
  { label: "Rooms", href: "/rooms" },
  { label: "Messages", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Activity", href: "#" },
  { label: "People", href: "#" },
];

export function AppNavbar({ user }: { user: PrivateUser }) {
  const pathname = usePathname();
  const commandPalette = useCommandPalette();

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-mono text-base font-semibold tracking-tight text-foreground">
            commit<span className="text-accent">.ly</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {APP_LINKS.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : link.href !== "#" && pathname.startsWith(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`focus-ring relative rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-accent-soft text-foreground after:absolute after:inset-x-2 after:-bottom-2.25 after:h-0.5 after:rounded-full after:bg-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={commandPalette.open}
            title="Search Commit.ly (Ctrl+K)"
            aria-label="Search Commit.ly"
            className="focus-ring hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-2 transition-colors hover:bg-background-3 hover:text-foreground sm:flex"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Search
            <kbd className="rounded border border-border-strong bg-background-3 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
          <ThemeToggle />
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className="focus-ring relative rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>
    <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} currentRoom={null} />
    </>
  );
}
