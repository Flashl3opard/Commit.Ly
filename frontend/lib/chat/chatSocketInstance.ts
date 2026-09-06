import { ChatSocket } from "./ChatSocket";

function resolveWsUrl(): string {
  const httpUrl = process.env.NEXT_PUBLIC_CHAT_API_URL;
  if (!httpUrl) {
    throw new Error("NEXT_PUBLIC_CHAT_API_URL is not configured.");
  }
  return httpUrl.replace(/^http/, "ws");
}

let instance: ChatSocket | null = null;

/**
 * One ChatSocket per browser session, not per component/hook instance —
 * React StrictMode double-invokes effects and multiple components may want
 * to observe connection state simultaneously; neither should open a second
 * physical WebSocket connection.
 */
export function getChatSocket(): ChatSocket {
  if (!instance) {
    instance = new ChatSocket(resolveWsUrl());
  }
  return instance;
}
