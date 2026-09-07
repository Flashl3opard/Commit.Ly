"use client";

import { useEffect } from "react";

/**
 * Only rendered if the ROOT layout itself throws — providers, fonts, the
 * theme-init script, etc. never got a chance to mount, so this can't use
 * ErrorState/CommitlyCat (they depend on CSS custom properties the layout
 * sets up) or any app component. It ships its own minimal inline-styled
 * <html>/<body>, deliberately as plain as possible since this path should
 * almost never execute.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          fontFamily: "system-ui, sans-serif",
          background: "#06080b",
          color: "#f4f7fb",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>500 — Something broke upstream.</h1>
        <p style={{ fontSize: "0.875rem", color: "#8a97a8", margin: 0, maxWidth: "24rem" }}>
          An unexpected error occurred while loading Commit.ly. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(148, 199, 224, 0.28)",
            background: "transparent",
            color: "#f4f7fb",
            padding: "0.375rem 0.875rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
