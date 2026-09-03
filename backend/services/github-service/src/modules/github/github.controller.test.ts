import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_CLIENT_ID ??= "test-client-id";
process.env.GITHUB_CLIENT_SECRET ??= "test-client-secret";
process.env.GITHUB_CALLBACK_URL ??= "http://127.0.0.1:4002/github/callback";

const mockGetGithubLinkState = vi.fn();

vi.mock("./userServiceClient", async () => {
  const actual = await vi.importActual<typeof import("./userServiceClient.js")>("./userServiceClient.js");
  return {
    ...actual,
    getGithubLinkState: (...args: unknown[]) => mockGetGithubLinkState(...args),
  };
});

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

describe("GitHub Service protected routes", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    // TS's node16 dynamic-import inference doesn't narrow this CJS default
    // export correctly; asserted since the runtime shape is verified by the
    // tests themselves (an incorrect app value would fail every request below).
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /github/connect", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/github/connect");
      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const expired = signToken("user-1", -10);
      const res = await request(app).get("/github/connect").set("Cookie", [`token=${expired}`]);
      expect(res.status).toBe(401);
    });

    it("redirects to GitHub for a valid session", async () => {
      const token = signToken("user-42");
      const res = await request(app).get("/github/connect").set("Cookie", [`token=${token}`]);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
    });
  });

  describe("GET /github/status", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/github/status");
      expect(res.status).toBe(401);
    });

    it("returns 401 for a malformed cookie", async () => {
      const res = await request(app).get("/github/status").set("Cookie", ["token=garbage"]);
      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const expired = signToken("user-1", -10);
      const res = await request(app).get("/github/status").set("Cookie", [`token=${expired}`]);
      expect(res.status).toBe(401);
    });

    it("returns connected: false for a valid session with no linked GitHub account", async () => {
      mockGetGithubLinkState.mockResolvedValue({ id: "user-42", githubUsername: null, githubVerified: false });
      const token = signToken("user-42");

      const res = await request(app).get("/github/status").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false, github: null, verified: false });
    });

    it("returns connected: true with the username for a linked, verified account", async () => {
      mockGetGithubLinkState.mockResolvedValue({ id: "user-42", githubUsername: "octocat", githubVerified: true });
      const token = signToken("user-42");

      const res = await request(app).get("/github/status").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: true, github: { username: "octocat" }, verified: true });
    });
  });

  describe("DELETE /github/disconnect", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).delete("/github/disconnect");
      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const expired = signToken("user-1", -10);
      const res = await request(app).delete("/github/disconnect").set("Cookie", [`token=${expired}`]);
      expect(res.status).toBe(401);
    });
  });
});
