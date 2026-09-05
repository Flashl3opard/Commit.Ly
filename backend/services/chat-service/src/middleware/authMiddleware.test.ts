import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("authMiddleware", () => {
  let authMiddleware: typeof import("./authMiddleware.js").authMiddleware;

  beforeAll(async () => {
    authMiddleware = (await import("./authMiddleware.js")).authMiddleware;
  });

  it("returns 401 when the token cookie is missing", () => {
    const req = { cookies: {} } as Request;
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed token", () => {
    const req = { cookies: { token: "garbage" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired token", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { cookies: { token: expired } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches req.user for a token signed with the shared JWT_SECRET", () => {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign({ userId: "user-42" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const req = { cookies: { token } } as unknown as Request;
    const res = mockRes();
    const next: NextFunction = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: "user-42" });
    expect(res.status).not.toHaveBeenCalled();
  });
});
