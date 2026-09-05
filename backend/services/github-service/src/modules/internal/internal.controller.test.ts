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
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.GITHUB_APP_ID ??= "test-app-id";
process.env.GITHUB_APP_SLUG ??= "commitly-test";
process.env.GITHUB_APP_CLIENT_ID ??= "test-app-client-id";
process.env.GITHUB_APP_CLIENT_SECRET ??= "test-app-client-secret";
process.env.GITHUB_APP_PRIVATE_KEY ??= "test-app-private-key";
process.env.GITHUB_APP_WEBHOOK_SECRET ??= "test-app-webhook-secret";
process.env.GITHUB_APP_CALLBACK_URL ??= "http://127.0.0.1:4002/github/app/callback";

const mockFindUniqueRepository = vi.fn();

vi.mock("../../config/prisma", () => ({
  prisma: {
    githubRepository: {
      findUnique: (...args: unknown[]) => mockFindUniqueRepository(...args),
    },
  },
}));

describe("GET /internal/github/repositories/:id", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without the internal service secret header", async () => {
    const res = await request(app).get("/internal/github/repositories/repo-uuid-1");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an incorrect internal service secret", async () => {
    const res = await request(app)
      .get("/internal/github/repositories/repo-uuid-1")
      .set("x-internal-service-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the repository does not exist", async () => {
    mockFindUniqueRepository.mockResolvedValue(null);

    const res = await request(app)
      .get("/internal/github/repositories/missing-repo")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(404);
  });

  it("returns safe repository + installation ownership info with a valid internal secret", async () => {
    mockFindUniqueRepository.mockResolvedValue({
      id: "repo-uuid-1",
      githubRepositoryId: BigInt(123),
      name: "my-project",
      fullName: "octocat/my-project",
      htmlUrl: "https://github.com/octocat/my-project",
      private: true,
      defaultBranch: "main",
      installation: {
        userId: "user-42",
        accountLogin: "octocat",
        accountType: "User",
        active: true,
      },
    });

    const res = await request(app)
      .get("/internal/github/repositories/repo-uuid-1")
      .set("x-internal-service-secret", "test-internal-secret");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      repository: {
        id: "repo-uuid-1",
        githubRepositoryId: "123",
        name: "my-project",
        fullName: "octocat/my-project",
        htmlUrl: "https://github.com/octocat/my-project",
        private: true,
        defaultBranch: "main",
        installationOwnerUserId: "user-42",
        accountLogin: "octocat",
        accountType: "User",
        active: true,
      },
    });
  });

  it("never includes installation access tokens, App JWTs, or secrets in the response", async () => {
    mockFindUniqueRepository.mockResolvedValue({
      id: "repo-uuid-1",
      githubRepositoryId: BigInt(123),
      name: "my-project",
      fullName: "octocat/my-project",
      htmlUrl: "https://github.com/octocat/my-project",
      private: true,
      defaultBranch: "main",
      installation: { userId: "user-42", accountLogin: "octocat", accountType: "User", active: true },
    });

    const res = await request(app)
      .get("/internal/github/repositories/repo-uuid-1")
      .set("x-internal-service-secret", "test-internal-secret");

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/token/i);
    expect(raw).not.toMatch(/private_key/i);
    expect(raw).not.toMatch(/secret/i);
  });
});
