import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * The icon rail (layer 1 nav) is now provided by AppShell itself for every
 * authenticated route, not just /rooms/* — this layout only needs to opt
 * into fillHeight, since /rooms pages manage their own internal scroll
 * regions (contextual sub-sidebar + main pane) instead of scrolling the
 * whole page.
 */
export default function RoomsLayout({ children }: { children: ReactNode }) {
  return <AppShell fillHeight>{children}</AppShell>;
}
