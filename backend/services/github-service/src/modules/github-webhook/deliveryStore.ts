// Lightweight in-memory idempotency store for GitHub webhook deliveries.
//
// GitHub retries webhook deliveries (e.g. on timeout or non-2xx response),
// each retry carrying the SAME `X-GitHub-Delivery` id. We must not process
// a delivery twice — but we also must not mark a delivery "done" before its
// downstream processing (Chat Service system-message creation) actually
// succeeds, since a webhook response of 5xx tells GitHub to retry, and that
// retry must be allowed to actually try again.
//
// This uses explicit two-state tracking rather than plain "seen once"
// semantics:
//   - "completed": the delivery was fully processed (or intentionally
//     skipped, e.g. unsupported event/no room) — a retry is a true no-op.
//   - no entry: never seen, or a previous attempt failed and was released —
//     free to process.
// There is deliberately no third persisted "processing" state: a single
// Node process handles one request at a time for a given delivery in
// practice, and persisting an in-progress marker across a crash would only
// create a way to permanently wedge a delivery as "stuck in progress" with
// no owner left to complete or release it. If this service is ever
// horizontally scaled, a shared store with real lease/lock semantics would
// be required — deliberately out of scope for this stage.
//
// This is a single-process, bounded, TTL-based store — appropriate for the
// current single-instance local architecture. It is NOT a distributed
// dedup mechanism: if this service is horizontally scaled behind a load
// balancer, each instance has its own independent store, and retries could
// land on a different instance and be reprocessed. A shared store (e.g.
// Redis) would be required at that point — deliberately out of scope here.

type DeliveryEntry = { completedAt: number };

const DELIVERY_TTL_MS = 10 * 60 * 1000; // 10 minutes — comfortably covers GitHub's retry window
const MAX_ENTRIES = 5000; // bounds memory even if sweeps somehow fall behind

const completedDeliveries = new Map<string, DeliveryEntry>();

function sweepExpired(now: number) {
  for (const [deliveryId, entry] of completedDeliveries) {
    if (now - entry.completedAt >= DELIVERY_TTL_MS) {
      completedDeliveries.delete(deliveryId);
    }
  }
}

function evictOldestIfOverCapacity() {
  if (completedDeliveries.size <= MAX_ENTRIES) return;
  // Map iteration order is insertion order, so the first key is the oldest.
  const oldestKey = completedDeliveries.keys().next().value;
  if (oldestKey !== undefined) {
    completedDeliveries.delete(oldestKey);
  }
}

/**
 * True if this delivery has already been fully processed. A false result
 * means the caller should proceed with processing — either it's genuinely
 * new, or a previous attempt did not reach markDeliveryCompleted (e.g. Chat
 * Service was unavailable), so it must be retried, not skipped.
 */
export function isDeliveryCompleted(deliveryId: string): boolean {
  sweepExpired(Date.now());
  return completedDeliveries.has(deliveryId);
}

/**
 * Marks a delivery as fully processed. Call this only after all downstream
 * work for the delivery has succeeded (or was safely skipped, e.g. no
 * matching room) — never before, and never on a path that returns a
 * retryable failure to GitHub.
 */
export function markDeliveryCompleted(deliveryId: string): void {
  const now = Date.now();
  sweepExpired(now);
  completedDeliveries.set(deliveryId, { completedAt: now });
  evictOldestIfOverCapacity();
}

/** Test-only: resets the store and its bounds so tests don't leak state. */
export function __resetDeliveryStoreForTests() {
  completedDeliveries.clear();
}

/** Test-only: exposes current size for bounding tests. */
export function __deliveryStoreSizeForTests() {
  return completedDeliveries.size;
}

export const DELIVERY_TTL_MS_FOR_TESTS = DELIVERY_TTL_MS;
export const MAX_ENTRIES_FOR_TESTS = MAX_ENTRIES;
