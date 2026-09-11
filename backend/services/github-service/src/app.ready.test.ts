import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.CHAT_SERVICE_URL ??= "http://localhost:4004";
process.env.GITHUB_CLIENT_ID ??= "test-client-id";
process.env.GITHUB_CLIENT_SECRET ??= "test-client-secret";
process.env.GITHUB_CALLBACK_URL ??= "http://127.0.0.1:4002/github/callback";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.GITHUB_APP_ID ??= "test-app-id";
process.env.GITHUB_APP_SLUG ??= "test-app-slug";
process.env.GITHUB_APP_CLIENT_ID ??= "test-app-client-id";
process.env.GITHUB_APP_CLIENT_SECRET ??= "test-app-client-secret";
process.env.GITHUB_APP_PRIVATE_KEY ??= "test-app-private-key";
process.env.GITHUB_APP_WEBHOOK_SECRET ??= "test-app-webhook-secret";
process.env.GITHUB_APP_CALLBACK_URL ??= "http://127.0.0.1:4002/github/app/callback";

describe("GET /ready", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("./app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  it("returns 200 and reports Kafka configuration state without requiring Kafka to be reachable", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.kafka.configured).toBe("boolean");
  });

  it("never exposes broker addresses or credentials", async () => {
    const res = await request(app).get("/ready");
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/localhost:9092/);
    expect(raw).not.toMatch(/broker/i);
    expect(raw).not.toMatch(/secret/i);
  });

  it("/health stays unaffected by Kafka state (unconditional 200)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
