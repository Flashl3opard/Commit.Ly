import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";

// This file exercises the GitHub App routes with NO GitHub App env vars set
// at all, verifying the service degrades to clean 503s instead of crashing.
// It must run with its own fresh module registry, since githubApp.config's
// exported config object is computed once at import time.

const REQUIRED_APP_VARS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_WEBHOOK_SECRET",
  "GITHUB_APP_CALLBACK_URL",
] as const;

const previousValues: Record<string, string | undefined> = {};

for (const key of REQUIRED_APP_VARS) {
  previousValues[key] = process.env[key];
  delete process.env[key];
}

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.GITHUB_CLIENT_ID ??= "test-client-id";
process.env.GITHUB_CLIENT_SECRET ??= "test-client-secret";
process.env.GITHUB_CALLBACK_URL ??= "http://127.0.0.1:4002/github/callback";
process.env.FRONTEND_URL ??= "http://localhost:3000";

vi.mock("../../config/prisma", () => ({
  prisma: {
    githubInstallation: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    githubRepository: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

describe("GitHub App routes with no GitHub App configuration", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    vi.resetModules();
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterAll(() => {
    for (const key of REQUIRED_APP_VARS) {
      if (previousValues[key] === undefined) delete process.env[key];
      else process.env[key] = previousValues[key];
    }
  });

  it("GET /health still works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("existing GitHub OAuth /github/connect still requires auth normally (unaffected by App config)", async () => {
    const res = await request(app).get("/github/connect");
    expect(res.status).toBe(401);
  });

  it("GET /github/app/install returns 401 without a session, not 503 (auth checked first)", async () => {
    const res = await request(app).get("/github/app/install");
    expect(res.status).toBe(401);
  });

  it("GET /github/app/install returns 503 with a safe message for an authenticated user", async () => {
    const token = signToken("user-42");
    const res = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "GitHub App is not configured." });
  });

  it("GET /github/app/status returns installed: false rather than an error", async () => {
    const token = signToken("user-42");
    const res = await request(app).get("/github/app/status").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ installed: false, installation: null });
  });

  it("GET /github/app/repositories returns 503 with a safe message", async () => {
    const token = signToken("user-42");
    const res = await request(app).get("/github/app/repositories").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "GitHub App is not configured." });
  });

  it("GET /github/app/callback returns 503 rather than crashing", async () => {
    const res = await request(app)
      .get("/github/app/callback")
      .query({ installation_id: "1", state: "whatever" });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "GitHub App is not configured." });
  });

  it("never exposes internal configuration details in the 503 response", async () => {
    const token = signToken("user-42");
    const res = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
    const raw = JSON.stringify(res.body);

    expect(raw).not.toMatch(/private/i);
    expect(raw).not.toMatch(/secret/i);
    expect(raw).not.toMatch(/GITHUB_APP_/);
  });
});
