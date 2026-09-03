import { randomBytes } from "node:crypto";

type StateEntry = {
  userId: string;
  codeVerifier: string;
  expiresAt: number;
};

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const states = new Map<string, StateEntry>();

function sweepExpired() {
  const now = Date.now();
  for (const [state, entry] of states) {
    if (entry.expiresAt <= now) {
      states.delete(state);
    }
  }
}

export function createOAuthState(userId: string, codeVerifier: string): string {
  sweepExpired();
  const state = randomBytes(32).toString("hex");
  states.set(state, { userId, codeVerifier, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

/**
 * Consumes (single-use) and validates a stored OAuth state. Returns null if
 * the state is missing, expired, or already used.
 */
export function consumeOAuthState(state: string): { userId: string; codeVerifier: string } | null {
  sweepExpired();
  const entry = states.get(state);
  if (!entry) {
    return null;
  }
  states.delete(state);
  if (entry.expiresAt <= Date.now()) {
    return null;
  }
  return { userId: entry.userId, codeVerifier: entry.codeVerifier };
}
