import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";

const mockGetGithubIdentityState = vi.fn();

vi.mock("../user/user.service", async () => {
  const actual = await vi.importActual<typeof import("../user/user.service.js")>("../user/user.service.js");
  return {
    ...actual,
    getGithubIdentityState: (...args: unknown[]) => mockGetGithubIdentityState(...args),
    linkGithubIdentity: vi.fn(),
    unlinkGithubIdentity: vi.fn(),
  };
});

describe("GET /internal/users/:id/github", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app).get("/internal/users/user-1/github");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an incorrect internal service secret", async () => {
    const res = await request(app)
      .get("/internal/users/user-1/github")
      .set("x-internal-service-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user does not exist", async () => {
    mockGetGithubIdentityState.mockResolvedValue(null);

    const res = await request(app)
      .get("/internal/users/user-missing/github")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns the raw githubId with a valid internal secret", async () => {
    mockGetGithubIdentityState.mockResolvedValue({
      githubId: "12345",
      githubUsername: "octocat",
      githubVerified: true,
    });

    const res = await request(app)
      .get("/internal/users/user-42/github")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      identity: { githubId: "12345", githubUsername: "octocat", githubVerified: true },
    });
  });
});
