"use client";

import { useEffect, useState } from "react";
import { listFriendRequests } from "@/lib/api/users";

const POLL_INTERVAL_MS = 30_000;

/**
 * Backs the rail's notification bell badge with a real count — pending
 * incoming friend requests are the only notification-worthy event this
 * product has today. No fake/decorative badge: the count is exactly
 * what GET /users/friend-requests reports, polled rather than pushed
 * over WebSocket since friend requests are low-frequency enough that a
 * dedicated realtime channel isn't warranted yet.
 */
export function useIncomingFriendRequestCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    function refresh() {
      listFriendRequests()
        .then(({ incoming }) => {
          if (!cancelled) setCount(incoming.length);
        })
        .catch(() => {
          // A transient failure leaves the last-known count displayed
          // rather than flashing to zero.
        });
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  // Derived rather than reset via a setState call inside the effect above
  // (see RoomsProvider's identical reasoning) — disabled always reads as
  // zero regardless of what the last poll left behind, and re-enabling
  // starts a fresh poll cycle from the effect without needing a separate
  // reset branch.
  return enabled ? count : 0;
}
