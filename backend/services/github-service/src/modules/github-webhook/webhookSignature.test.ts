import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./webhookSignature";

const SECRET = "test-webhook-secret";

function sign(secret: string, payload: Buffer): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const payload = Buffer.from(JSON.stringify({ hello: "world" }));
    const signature = sign(SECRET, payload);

    const result = verifyWebhookSignature(payload, signature, SECRET);
    expect(result).toEqual({ valid: true });
  });

  it("rejects an invalid signature (wrong digest)", () => {
    const payload = Buffer.from(JSON.stringify({ hello: "world" }));
    const wrongSignature = "sha256=" + "0".repeat(64);

    const result = verifyWebhookSignature(payload, wrongSignature, SECRET);
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects when the signature was computed with the wrong secret", () => {
    const payload = Buffer.from(JSON.stringify({ hello: "world" }));
    const signature = sign("a-different-secret", payload);

    const result = verifyWebhookSignature(payload, signature, SECRET);
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a missing signature header", () => {
    const payload = Buffer.from("{}");
    const result = verifyWebhookSignature(payload, undefined, SECRET);
    expect(result).toEqual({ valid: false, reason: "missing_signature" });
  });

  it("rejects a malformed signature header (no sha256= prefix)", () => {
    const payload = Buffer.from("{}");
    const result = verifyWebhookSignature(payload, "not-a-real-signature", SECRET);
    expect(result).toEqual({ valid: false, reason: "malformed_signature" });
  });

  it("rejects a signature using the wrong algorithm prefix", () => {
    const payload = Buffer.from("{}");
    const signature = "sha1=" + createHmac("sha1", SECRET).update(payload).digest("hex");
    const result = verifyWebhookSignature(payload, signature, SECRET);
    expect(result).toEqual({ valid: false, reason: "malformed_signature" });
  });

  it("rejects a signature with non-hex characters after the prefix", () => {
    const payload = Buffer.from("{}");
    const result = verifyWebhookSignature(payload, "sha256=" + "z".repeat(64), SECRET);
    expect(result).toEqual({ valid: false, reason: "malformed_signature" });
  });

  it("rejects when the secret is not configured", () => {
    const payload = Buffer.from("{}");
    const signature = sign(SECRET, payload);
    const result = verifyWebhookSignature(payload, signature, undefined);
    expect(result).toEqual({ valid: false, reason: "not_configured" });
  });

  it("handles an empty body correctly", () => {
    const payload = Buffer.from("");
    const signature = sign(SECRET, payload);
    const result = verifyWebhookSignature(payload, signature, SECRET);
    expect(result).toEqual({ valid: true });
  });

  it("rejects an empty body with a signature computed for different content", () => {
    const payload = Buffer.from("");
    const signature = sign(SECRET, Buffer.from("not-empty"));
    const result = verifyWebhookSignature(payload, signature, SECRET);
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("uses a timing-safe comparison path (does not throw on differing-length attacker input)", () => {
    const payload = Buffer.from("{}");
    // Shorter-than-valid digest after the prefix — must be caught by the
    // hex-format check before ever reaching timingSafeEqual, not throw.
    expect(() => verifyWebhookSignature(payload, "sha256=abc", SECRET)).not.toThrow();
    const result = verifyWebhookSignature(payload, "sha256=abc", SECRET);
    expect(result.valid).toBe(false);
  });
});
