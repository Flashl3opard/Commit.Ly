import type { ClientMessage, ServerMessage } from "./protocol";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

type Listener = (message: ServerMessage) => void;
type StateListener = (state: ConnectionState) => void;

const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * One WebSocket connection per session, reused across room navigations —
 * callers send room.join/room.leave to switch which room's events this
 * socket receives, rather than reconnecting the whole socket per room.
 *
 * The browser never handles or reads the JWT: the httpOnly `token` cookie
 * is attached automatically by the browser on the WebSocket handshake
 * request, exactly like the initial page load or any same-origin fetch.
 */
export class ChatSocket {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private readonly listeners = new Set<Listener>();
  private readonly stateListeners = new Set<StateListener>();
  // Frames sent while not yet connected are queued and flushed on open,
  // rather than silently dropped — covers the common case of a component
  // calling joinRoom() before the initial connection has finished.
  private readonly pendingSends: ClientMessage[] = [];

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionallyClosed = false;
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState("connected");
      for (const message of this.pendingSends.splice(0)) {
        this.send(message);
      }
    };

    ws.onmessage = (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const listener of this.listeners) listener(parsed);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // a newer socket has already replaced this one
      this.ws = null;
      if (this.intentionallyClosed) {
        this.setState("disconnected");
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // 'close' always follows 'error' for a WebSocket — cleanup and
      // reconnect scheduling happens there, not here, to avoid doing it twice.
    };
  }

  private scheduleReconnect(): void {
    this.setState("reconnecting");
    const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempt += 1;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionallyClosed) this.connect();
    }, delay);
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.pendingSends.push(message);
    }
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }
}
