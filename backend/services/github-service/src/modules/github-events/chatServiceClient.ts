import { internalConfig } from "../../config/internal";

export class ChatServiceClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 5000;

export type CreateSystemMessageRequest = {
  eventType: string;
  content: string;
  metadata: Record<string, unknown>;
};

/**
 * Creates a GitHub activity system message in a room via Chat Service's
 * internal API. Authenticates with the shared internal service secret —
 * never a user JWT, never impersonating a user. Never logs the message
 * content or metadata (only safe identifiers are logged by the caller).
 *
 * Throws ChatServiceClientError on any non-2xx response or network
 * failure/timeout — callers must treat that as "downstream processing
 * failed" and respond to GitHub with a retryable failure, not silently
 * swallow it.
 */
export async function createSystemMessage(roomId: string, input: CreateSystemMessageRequest): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${internalConfig.chatServiceUrl}/internal/rooms/${encodeURIComponent(roomId)}/system-messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-secret": internalConfig.serviceSecret,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    );
  } catch {
    throw new ChatServiceClientError("Chat Service request failed", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ChatServiceClientError("Chat Service request failed", response.status);
  }
}
