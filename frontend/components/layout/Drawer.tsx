"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: ReactNode;
};

export function Drawer({ open, onClose, side, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={onClose} role="presentation" />
      <div
        className={`relative flex h-full max-w-[85vw] flex-col bg-background shadow-2xl transition-transform ${
          side === "left" ? "mr-auto" : "ml-auto"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
