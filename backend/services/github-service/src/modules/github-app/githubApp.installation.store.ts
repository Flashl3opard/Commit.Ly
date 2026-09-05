import { randomBytes } from "node:crypto";

type InstallStateEntry = { userId: string; expiresAt: number };

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const states = new Map<string, InstallStateEntry>();

function sweepExpired() {
  const now = Date.now();
  for (const [state, entry] of states) {
    if (entry.expiresAt <= now) states.delete(state);
  }
}

export function createInstallState(userId: string): string {
  sweepExpired();
  const state = randomBytes(32).toString("hex");
  states.set(state, { userId, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

export function consumeInstallState(state: string): { userId: string } | null {
  sweepExpired();
  const entry = states.get(state);
  if (!entry) return null;
  states.delete(state);
  if (entry.expiresAt <= Date.now()) return null;
  return { userId: entry.userId };
}
