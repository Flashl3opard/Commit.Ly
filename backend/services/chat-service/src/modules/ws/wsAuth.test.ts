import { describe, it, expect } from "vitest";
import type { IncomingMessage } from "node:http";

process.env.JWT_SECRET ??= "test-secret-for-vitest";

function fakeRequest(cookieHeader?: string): IncomingMessage {
  return { headers: { cookie: cookieHeader } } as IncomingMessage;
}

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

describe("authenticateUpgradeRequest", () => {
  it("throws WsAuthError when there is no cookie header at all", async () => {
    const { authenticateUpgradeRequest, WsAuthError } = await import("./wsAuth.js");
    expect(() => authenticateUpgradeRequest(fakeRequest(undefined))).toThrow(WsAuthError);
  });

  it("throws WsAuthError when the token cookie is missing from a present cookie header", async () => {
    const { authenticateUpgradeRequest, WsAuthError } = await import("./wsAuth.js");
    expect(() => authenticateUpgradeRequest(fakeRequest("other=value; another=thing"))).toThrow(WsAuthError);
  });

  it("throws WsAuthError for a malformed token", async () => {
    const { authenticateUpgradeRequest, WsAuthError } = await import("./wsAuth.js");
    expect(() => authenticateUpgradeRequest(fakeRequest("token=garbage"))).toThrow(WsAuthError);
  });

  it("throws WsAuthError for an expired token", async () => {
    const { authenticateUpgradeRequest, WsAuthError } = await import("./wsAuth.js");
    const expired = signToken("user-1", -10);
    expect(() => authenticateUpgradeRequest(fakeRequest(`token=${expired}`))).toThrow(WsAuthError);
  });

  it("returns the userId for a valid token", async () => {
    const { authenticateUpgradeRequest } = await import("./wsAuth.js");
    const token = signToken("user-42");
    const result = authenticateUpgradeRequest(fakeRequest(`token=${token}`));
    expect(result).toEqual({ userId: "user-42" });
  });

  it("finds the token cookie among multiple cookies", async () => {
    const { authenticateUpgradeRequest } = await import("./wsAuth.js");
    const token = signToken("user-42");
    const result = authenticateUpgradeRequest(fakeRequest(`other=value; token=${token}; another=thing`));
    expect(result).toEqual({ userId: "user-42" });
  });

  it("never accepts a userId supplied directly instead of a valid token", async () => {
    const { authenticateUpgradeRequest, WsAuthError } = await import("./wsAuth.js");
    expect(() => authenticateUpgradeRequest(fakeRequest("token=user-42"))).toThrow(WsAuthError);
  });
});
