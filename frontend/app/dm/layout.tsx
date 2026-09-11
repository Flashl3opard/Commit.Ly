import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Same fillHeight reasoning as /rooms — the DM page manages its own
 * internal scroll regions (conversation list + thread pane) instead of
 * scrolling the whole page.
 */
export default function DmLayout({ children }: { children: ReactNode }) {
  return <AppShell fillHeight>{children}</AppShell>;
}
