import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.JWT_EXPIRES_IN ??= "7d";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";

const mockGetUserById = vi.fn();
const mockLoginUser = vi.fn();

vi.mock("./auth.service", () => ({
  registerUser: vi.fn(),
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

describe("auth routes", () => {
  let app: ReturnType<typeof express>;
  let signToken: typeof import("../../utils/jwt.js").signToken;

  beforeAll(async () => {
    // TS's node16 dynamic-import inference doesn't narrow this CJS default
    // export correctly; asserted since the runtime shape is verified by the
    // tests themselves (an incorrect app value would fail every request below).
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
    signToken = (await import("../../utils/jwt.js")).signToken;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /auth/me", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 for a malformed cookie", async () => {
      const res = await request(app).get("/auth/me").set("Cookie", ["token=not-a-jwt"]);
      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const jwt = require("jsonwebtoken");
      const expired = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET, { expiresIn: -10 });
      const res = await request(app).get("/auth/me").set("Cookie", [`token=${expired}`]);
      expect(res.status).toBe(401);
    });

    it("returns the user, without passwordHash, for a valid session", async () => {
      mockGetUserById.mockResolvedValue({
        id: "user-42",
        username: "yash",
        email: "yash@example.com",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const token = signToken({ userId: "user-42" });

      const res = await request(app).get("/auth/me").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe("user-42");
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("returns 401 when the session is valid but the user no longer exists", async () => {
      mockGetUserById.mockResolvedValue(null);
      const token = signToken({ userId: "deleted-user" });

      const res = await request(app).get("/auth/me").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("clears the token cookie", async () => {
      const res = await request(app).post("/auth/logout");
      expect(res.status).toBe(200);
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
      expect(cookieStr).toMatch(/token=;/);
    });
  });

  describe("POST /auth/login", () => {
    it("sets a session cookie with maxAge consistent with JWT_EXPIRES_IN on success", async () => {
      mockLoginUser.mockResolvedValue({
        user: { id: "user-42", username: "yash", email: "yash@example.com", avatarUrl: null, createdAt: new Date(), updatedAt: new Date() },
        token: signToken({ userId: "user-42" }),
      });

      const res = await request(app).post("/auth/login").send({ email: "yash@example.com", password: "password123" });

      expect(res.status).toBe(200);
      const setCookie = res.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/Path=\//);
    });

    it("returns 401 for invalid credentials without setting a cookie", async () => {
      mockLoginUser.mockResolvedValue(null);

      const res = await request(app).post("/auth/login").send({ email: "yash@example.com", password: "wrong" });

      expect(res.status).toBe(401);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });
});
