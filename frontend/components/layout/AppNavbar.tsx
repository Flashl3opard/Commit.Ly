"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { PrivateUser } from "@/lib/api/types";

const APP_LINKS = [
  { label: "Home", href: "/" },
  { label: "Rooms", href: "#" },
  { label: "Messages", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Activity", href: "#" },
  { label: "People", href: "#" },
];

export function AppNavbar({ user }: { user: PrivateUser }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-mono text-base font-semibold tracking-tight text-foreground">
            commit<span className="text-accent">.ly</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {APP_LINKS.map((link) => {
              const isActive = link.href === pathname;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`focus-ring rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-white/[0.06] text-foreground"
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
  );
}
