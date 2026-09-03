import { describe, it, expect, beforeAll } from "vitest";
import ms from "ms";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.JWT_EXPIRES_IN ??= "7d";

describe("jwt utils", () => {
  let signToken: typeof import("./jwt.js").signToken;
  let verifyToken: typeof import("./jwt.js").verifyToken;
  let getSessionMaxAgeMs: typeof import("./jwt.js").getSessionMaxAgeMs;

  beforeAll(async () => {
    const mod = await import("./jwt.js");
    signToken = mod.signToken;
    verifyToken = mod.verifyToken;
    getSessionMaxAgeMs = mod.getSessionMaxAgeMs;
  });

  it("signs a token that verifies back to the same payload", () => {
    const token = signToken({ userId: "user-123" });
    const payload = verifyToken(token);
    expect(payload.userId).toBe("user-123");
  });

  it("rejects a malformed token", () => {
    expect(() => verifyToken("not-a-real-jwt")).toThrow();
  });

  it("rejects a token signed with a different secret", () => {
    // Simulate a forged/foreign token by signing manually with a wrong secret.
    const jwt = require("jsonwebtoken");
    const forged = jwt.sign({ userId: "attacker" }, "wrong-secret", { expiresIn: "1h" });
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects an already-expired token", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign({ userId: "user-123" }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect(() => verifyToken(expired)).toThrow(/expired/i);
  });

  it("derives a session cookie maxAge consistent with the configured JWT_EXPIRES_IN", () => {
    const maxAge = getSessionMaxAgeMs();
    expect(maxAge).toBe(ms(process.env.JWT_EXPIRES_IN as Parameters<typeof ms>[0]));
  });
});
