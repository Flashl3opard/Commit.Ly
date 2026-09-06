import type { IncomingMessage } from "node:http";
import { verifyToken } from "../../utils/jwt";

export class WsAuthError extends Error {}

const TOKEN_COOKIE_NAME = "token";

/**
 * Extracts a single cookie value from a raw Cookie header, without adding a
 * dependency on the `cookie` package for one field. Express's cookie-parser
 * middleware never runs on a raw HTTP `upgrade` request, so this duplicates
 * just enough of its parsing to find `token`.
 */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

/**
 * Authenticates a WebSocket upgrade request the same way authMiddleware
 * authenticates a normal HTTP request: read the httpOnly `token` cookie
 * (sent automatically by the browser on the handshake request, exactly
 * like any other same-origin request) and verify it with the shared
 * JWT_SECRET. Never accepts a userId supplied by the client in any other
 * way — the cookie is the only source of identity.
 */
export function authenticateUpgradeRequest(req: IncomingMessage): { userId: string } {
  const token = readCookie(req.headers.cookie, TOKEN_COOKIE_NAME);
  if (!token) {
    throw new WsAuthError("Authentication required.");
  }

  try {
    const payload = verifyToken(token);
    return { userId: payload.userId };
  } catch {
    throw new WsAuthError("Authentication required.");
  }
}
