import { createHmac, timingSafeEqual } from "node:crypto";

// GitHub signs the raw request body with HMAC SHA-256, keyed by the webhook
// secret configured on the GitHub App. The header format is:
//   X-Hub-Signature-256: sha256=<hex digest>
// Verification MUST run against the exact raw bytes GitHub sent — never a
// re-serialized (e.g. JSON.stringify) version of the parsed body, since
// re-serialization is not guaranteed to byte-for-byte match the original.

const SIGNATURE_PREFIX = "sha256=";

export type SignatureVerificationResult =
  | { valid: true }
  | { valid: false; reason: "missing_signature" | "malformed_signature" | "signature_mismatch" | "not_configured" };

function computeSignature(secret: string, payload: Buffer): string {
  return SIGNATURE_PREFIX + createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies a GitHub webhook's `X-Hub-Signature-256` header against the raw
 * request payload. Always uses a timing-safe comparison for the actual
 * digest check — never a plain `===` on the signature strings.
 *
 * The returned `reason` is for internal logging/tests only; callers must
 * not reflect it back to the HTTP caller (a generic 401 is used at the
 * route level so an attacker cannot learn which check failed).
 */
export function verifyWebhookSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string | undefined
): SignatureVerificationResult {
  if (!secret) {
    return { valid: false, reason: "not_configured" };
  }

  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature" };
  }

  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return { valid: false, reason: "malformed_signature" };
  }

  const providedDigestHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  // A valid SHA-256 hex digest is exactly 64 hex characters.
  if (!/^[0-9a-f]{64}$/i.test(providedDigestHex)) {
    return { valid: false, reason: "malformed_signature" };
  }

  const expectedSignature = computeSignature(secret, payload);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(signatureHeader);

  // timingSafeEqual throws on length mismatch, so compare fixed-length
  // buffers only after confirming both are well-formed sha256= strings of
  // the same length (they always are here, since both are `sha256=` plus
  // 64 hex chars) — but guard defensively anyway.
  if (expected.length !== provided.length) {
    return { valid: false, reason: "signature_mismatch" };
  }

  const matches = timingSafeEqual(expected, provided);
  return matches ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
