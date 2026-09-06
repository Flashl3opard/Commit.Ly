import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { createHmac } from "node:crypto";

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
const WEBHOOK_SECRET = "test-app-webhook-secret";
process.env.GITHUB_APP_WEBHOOK_SECRET ??= WEBHOOK_SECRET;
process.env.GITHUB_APP_CALLBACK_URL ??= "http://127.0.0.1:4002/github/app/callback";

vi.mock("../../config/prisma", () => ({
  prisma: {
    githubInstallation: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    githubRepository: { findMany: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Defaults to "no room found" so existing Stage A/webhook-boundary tests
// (which only care about signature/header/idempotency behavior) see a
// clean 200 rather than a downstream 502. Tests that specifically exercise
// Stage C override these per-test.
const mockFindRoomByGithubRepositoryId = vi.fn().mockResolvedValue(null);
vi.mock("../github-events/roomServiceClient", () => ({
  findRoomByGithubRepositoryId: (...args: unknown[]) => mockFindRoomByGithubRepositoryId(...args),
  RoomServiceClientError: class RoomServiceClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockCreateSystemMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("../github-events/chatServiceClient", () => ({
  createSystemMessage: (...args: unknown[]) => mockCreateSystemMessage(...args),
  ChatServiceClientError: class ChatServiceClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

function sign(payload: Buffer, secret = WEBHOOK_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

function pushPayload(overrides: Record<string, unknown> = {}) {
  return {
    ref: "refs/heads/main",
    after: "abc123def456",
    repository: { id: 123456, full_name: "octocat/hello-world" },
    sender: { login: "octocat" },
    ...overrides,
  };
}

function pullRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: "opened",
    repository: { id: 555, full_name: "octocat/hello-world" },
    sender: { login: "octocat" },
    pull_request: { number: 42, title: "Add feature X", html_url: "https://github.com/octocat/hello-world/pull/42" },
    ...overrides,
  };
}

function issuesPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: "opened",
    repository: { id: 777, full_name: "octocat/hello-world" },
    sender: { login: "octocat" },
    issue: { number: 7, title: "Bug report", html_url: "https://github.com/octocat/hello-world/issues/7" },
    ...overrides,
  };
}

let deliveryCounter = 0;
function nextDeliveryId(): string {
  deliveryCounter += 1;
  return `delivery-${deliveryCounter}-${Math.random().toString(16).slice(2)}`;
}

describe("POST /github/webhooks", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function send(body: object, headers: Record<string, string>) {
    // supertest/superagent would JSON-re-serialize a Buffer passed to
    // .send() when Content-Type is application/json (it treats a Buffer as
    // a plain object), which defeats the purpose of exercising raw-body
    // signature verification. Sending the exact JSON string instead
    // preserves the byte-for-byte body the signature was computed over.
    const raw = JSON.stringify(body);
    let req = request(app).post("/github/webhooks").set("Content-Type", "application/json");
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }
    return req.send(raw);
  }

  // ---- Signature tests ----

  it("accepts a valid signature", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
  });

  it("rejects an invalid signature", async () => {
    const payload = pushPayload();
    const res = await send(payload, {
      "X-Hub-Signature-256": "sha256=" + "0".repeat(64),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a missing signature", async () => {
    const payload = pushPayload();
    const res = await send(payload, {
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed signature", async () => {
    const payload = pushPayload();
    const res = await send(payload, {
      "X-Hub-Signature-256": "not-a-signature",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw, "wrong-secret"),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
  });

  it("does not reveal which part of validation failed", async () => {
    const res = await send(pushPayload(), {
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/secret/i);
    expect(raw).not.toMatch(/hmac/i);
    expect(raw).not.toMatch(/timing/i);
  });

  // ---- HTTP / event acceptance tests ----

  it("accepts a valid push webhook and delivers a system message when a room exists", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValueOnce("room-uuid-1");
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockCreateSystemMessage).toHaveBeenCalledWith(
      "room-uuid-1",
      expect.objectContaining({ eventType: "github.push" }),
    );
  });

  it("accepts a valid pull_request webhook and delivers a system message when a room exists", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValueOnce("room-uuid-1");
    const payload = pullRequestPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "pull_request",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockCreateSystemMessage).toHaveBeenCalledWith(
      "room-uuid-1",
      expect.objectContaining({ eventType: "github.pull_request.opened" }),
    );
  });

  it("accepts a valid issues webhook and delivers a system message when a room exists", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValueOnce("room-uuid-1");
    const payload = issuesPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "issues",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockCreateSystemMessage).toHaveBeenCalledWith(
      "room-uuid-1",
      expect.objectContaining({ eventType: "github.issue.opened" }),
    );
  });

  it("accepts a valid webhook but does not call Chat Service when no room exists for the repository", async () => {
    // mockFindRoomByGithubRepositoryId defaults to null (no room) per the module mock above.
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ignored: true });
    expect(mockCreateSystemMessage).not.toHaveBeenCalled();
  });

  it("safely ignores an unsupported event (e.g. installation)", async () => {
    const payload = { action: "created" };
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "installation",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ignored: true });
  });

  it("handles a missing X-GitHub-Event header", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(400);
  });

  it("handles a missing X-GitHub-Delivery header", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
    });
    expect(res.status).toBe(400);
  });

  it("handles a missing signature safely (already covered above but confirms 4xx not 5xx)", async () => {
    const payload = pushPayload();
    const res = await send(payload, {
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBeLessThan(500);
  });

  it("handles invalid JSON in the raw payload safely", async () => {
    const rawString = "{ this is not valid json";
    const raw = Buffer.from(rawString);
    const res = await request(app)
      .post("/github/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(raw))
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", nextDeliveryId())
      .send(rawString);
    expect(res.status).toBe(400);
  });

  it("handles a malformed supported payload safely (missing required fields)", async () => {
    const payload = { not: "a valid push event" };
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(422);
  });

  it("does not use JWT auth (no cookie required)", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await request(app)
      .post("/github/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(raw))
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", nextDeliveryId())
      .send(raw.toString("utf8"));
    // No cookie set at all, yet the request is accepted on signature alone.
    expect(res.status).toBe(200);
  });

  it("normal JSON REST endpoints still work (webhook raw-body mount does not break global JSON parsing)", async () => {
    const res = await request(app).get("/github/connect");
    // Unauthenticated OAuth connect still behaves as before (401, not broken by raw-body routing).
    expect(res.status).toBe(401);

    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok" });
  });

  // ---- Idempotency tests ----

  it("processes the same delivery id only once", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const deliveryId = nextDeliveryId();
    const headers = {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
    };

    const first = await send(payload, headers);
    const second = await send(payload, headers);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Both respond successfully — GitHub sees success either way — but
    // internally the second is recognized as a duplicate (verified via the
    // deliveryStore unit tests).
  });

  it("processes different delivery ids independently", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const sig = sign(raw);

    const first = await send(payload, { "X-Hub-Signature-256": sig, "X-GitHub-Event": "push", "X-GitHub-Delivery": nextDeliveryId() });
    const second = await send(payload, { "X-Hub-Signature-256": sig, "X-GitHub-Event": "push", "X-GitHub-Delivery": nextDeliveryId() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  // ---- Security tests ----

  it("rejects a forged webhook (signature does not match tampered payload)", async () => {
    const originalPayload = pushPayload();
    const raw = Buffer.from(JSON.stringify(originalPayload));
    const validSignature = sign(raw);

    // Attacker signs one payload, then swaps in a different one before sending.
    const tamperedPayload = pushPayload({ after: "malicious-sha" });
    const res = await send(tamperedPayload, {
      "X-Hub-Signature-256": validSignature,
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(401);
  });

  it("cannot impersonate a user (webhook response never carries a session/user identity)", async () => {
    const payload = pushPayload();
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(res.body).toEqual({ ok: true, ignored: true });
  });

  it("does not reach payload parsing for an invalid signature (no crash, no 5xx)", async () => {
    const res = await send(
      { repository: { id: "not-a-number-should-not-matter" } },
      { "X-Hub-Signature-256": "sha256=" + "1".repeat(64), "X-GitHub-Event": "push", "X-GitHub-Delivery": nextDeliveryId() }
    );
    expect(res.status).toBe(401);
  });

  it("a payload cannot inject arbitrary repository/user identity beyond what is validated", async () => {
    const payload = pushPayload({ repository: { id: 999, full_name: "attacker/repo", extra_field: "ignored" } });
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    // Accepted at the ingestion boundary (Stage A does no downstream writes
    // regardless of repository identity) — the point is that no crash or
    // unexpected behavior occurs from extra/untrusted fields.
    expect(res.status).toBe(200);
  });

  // ---- Event parsing (via HTTP, missing required fields case) ----

  it("handles missing required repository information safely for push", async () => {
    const payload = { ref: "refs/heads/main", after: "abc", sender: { login: "octocat" } };
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": nextDeliveryId(),
    });
    expect(res.status).toBe(422);
  });
});

describe("POST /github/webhooks — Stage C: GitHub -> Room -> Chat pipeline", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockFindRoomByGithubRepositoryId.mockResolvedValue(null);
    mockCreateSystemMessage.mockResolvedValue(undefined);
  });

  function send(body: object, headers: Record<string, string>) {
    const raw = JSON.stringify(body);
    let req = request(app).post("/github/webhooks").set("Content-Type", "application/json");
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }
    return req.send(raw);
  }

  function push(overrides: Record<string, unknown> = {}) {
    return {
      ref: "refs/heads/main",
      after: "abc123def456",
      repository: { id: 123456, full_name: "octocat/hello-world" },
      sender: { login: "octocat" },
      ...overrides,
    };
  }

  it("delivers the normalized event to the matching room", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValue("room-abc");
    const payload = push();
    const raw = Buffer.from(JSON.stringify(payload));
    const deliveryId = "stage-c-" + Math.random();

    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
    });

    expect(res.status).toBe(200);
    expect(mockFindRoomByGithubRepositoryId).toHaveBeenCalledWith("123456");
    expect(mockCreateSystemMessage).toHaveBeenCalledWith("room-abc", expect.objectContaining({ eventType: "github.push" }));
  });

  it("does not call Chat Service when no room matches the repository", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValue(null);
    const payload = push();
    const raw = Buffer.from(JSON.stringify(payload));

    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "stage-c-" + Math.random(),
    });

    expect(res.status).toBe(200);
    expect(mockCreateSystemMessage).not.toHaveBeenCalled();
  });

  it("never calls Room Service or Chat Service for an invalid signature", async () => {
    const payload = push();
    const res = await send(payload, {
      "X-Hub-Signature-256": "sha256=" + "0".repeat(64),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "stage-c-" + Math.random(),
    });

    expect(res.status).toBe(401);
    expect(mockFindRoomByGithubRepositoryId).not.toHaveBeenCalled();
    expect(mockCreateSystemMessage).not.toHaveBeenCalled();
  });

  it("does not create a duplicate message for a delivery already marked completed", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValue("room-abc");
    const payload = push();
    const raw = Buffer.from(JSON.stringify(payload));
    const deliveryId = "stage-c-repeat-" + Math.random();
    const headers = {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
    };

    const first = await send(payload, headers);
    expect(first.status).toBe(200);
    expect(mockCreateSystemMessage).toHaveBeenCalledTimes(1);

    const second = await send(payload, headers);
    expect(second.status).toBe(200);
    // Still only ever called once — the second delivery was recognized as
    // already completed and never reached Chat Service again.
    expect(mockCreateSystemMessage).toHaveBeenCalledTimes(1);
  });

  it("returns a 5xx and remains retryable when Chat Service fails", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValue("room-abc");
    mockCreateSystemMessage.mockRejectedValue(
      Object.assign(new Error("Chat Service request failed"), { status: 502 }),
    );
    const payload = push();
    const raw = Buffer.from(JSON.stringify(payload));
    const deliveryId = "stage-c-retry-" + Math.random();

    const res = await send(payload, {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it("a successful retry after a downstream failure creates exactly one message", async () => {
    mockFindRoomByGithubRepositoryId.mockResolvedValue("room-abc");
    const payload = push();
    const raw = Buffer.from(JSON.stringify(payload));
    const deliveryId = "stage-c-retry-success-" + Math.random();
    const headers = {
      "X-Hub-Signature-256": sign(raw),
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": deliveryId,
    };

    // First attempt: Chat Service is unavailable.
    const ChatServiceClientErrorCtor = (
      await import("../github-events/chatServiceClient.js")
    ).ChatServiceClientError;
    mockCreateSystemMessage.mockRejectedValueOnce(new ChatServiceClientErrorCtor("unavailable", 502));

    const first = await send(payload, headers);
    expect(first.status).toBeGreaterThanOrEqual(500);
    expect(mockCreateSystemMessage).toHaveBeenCalledTimes(1);

    // Second attempt (GitHub retry, same delivery id): Chat Service now succeeds.
    mockCreateSystemMessage.mockResolvedValueOnce(undefined);
    const second = await send(payload, headers);
    expect(second.status).toBe(200);
    expect(mockCreateSystemMessage).toHaveBeenCalledTimes(2);

    // Third attempt (a further GitHub retry after our 200): already
    // completed — must not create a second message.
    const third = await send(payload, headers);
    expect(third.status).toBe(200);
    expect(mockCreateSystemMessage).toHaveBeenCalledTimes(2);
  });
});
