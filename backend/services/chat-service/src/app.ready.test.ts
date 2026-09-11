import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";
process.env.ROOM_SERVICE_URL ??= "http://localhost:4003";
process.env.USER_SERVICE_URL ??= "http://localhost:4001";

describe("GET /ready", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("./app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  it("returns 200 and reports Kafka configuration + consumer state without requiring Kafka to be reachable", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.kafka.configured).toBe("boolean");
    expect(typeof res.body.kafka.githubEventsConsumerRunning).toBe("boolean");
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
