import jwt, { type SignOptions } from "jsonwebtoken";
import ms from "ms";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

export interface JwtPayload {
  userId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as JwtPayload;
}

/**
 * Session cookie lifetime in milliseconds, derived from the same
 * JWT_EXPIRES_IN value used to sign tokens (via the same duration parser
 * jsonwebtoken uses internally) so the cookie never outlives — or expires
 * before — the token it carries.
 */
export function getSessionMaxAgeMs(): number {
  return ms(JWT_EXPIRES_IN as Parameters<typeof ms>[0]);
}
