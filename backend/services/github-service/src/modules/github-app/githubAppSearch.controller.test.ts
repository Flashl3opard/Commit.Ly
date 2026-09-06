import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
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

const mockRepositoryFindUnique = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: {
    githubRepository: { findUnique: (...args: unknown[]) => mockRepositoryFindUnique(...args) },
  },
}));

const mockSearchRepositoryIssuesAndPullRequests = vi.fn();
vi.mock("./githubAppApi", async () => {
  const actual = await vi.importActual<typeof import("./githubAppApi.js")>("./githubAppApi.js");
  return {
    ...actual,
    searchRepositoryIssuesAndPullRequests: (...args: unknown[]) => mockSearchRepositoryIssuesAndPullRequests(...args),
  };
});

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

const REPO_ID = "repo-uuid-1";

describe("GET /github/app/repositories/:repositoryId/search", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get(`/github/app/repositories/${REPO_ID}/search?q=bug`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing query", async () => {
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the repository does not exist", async () => {
    mockRepositoryFindUnique.mockResolvedValue(null);
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=bug`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(404);
  });

  it("returns 403 when the repository's installation belongs to a different user", async () => {
    mockRepositoryFindUnique.mockResolvedValue({
      id: REPO_ID,
      fullName: "octocat/hello-world",
      installation: { userId: "someone-else", active: true, installationId: BigInt(999) },
    });
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=bug`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(403);
  });

  it("returns 403 when the installation is inactive", async () => {
    mockRepositoryFindUnique.mockResolvedValue({
      id: REPO_ID,
      fullName: "octocat/hello-world",
      installation: { userId: "user-1", active: false, installationId: BigInt(999) },
    });
    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=bug`)
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(403);
  });

  it("returns search results for the repository owner", async () => {
    mockRepositoryFindUnique.mockResolvedValue({
      id: REPO_ID,
      fullName: "octocat/hello-world",
      installation: { userId: "user-1", active: true, installationId: BigInt(999) },
    });
    mockSearchRepositoryIssuesAndPullRequests.mockResolvedValue([
      { id: 1, number: 42, title: "Add auth", state: "open", htmlUrl: "https://github.com/octocat/hello-world/pull/42", isPullRequest: true },
    ]);

    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=auth`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe("Add auth");
    expect(mockSearchRepositoryIssuesAndPullRequests).toHaveBeenCalledWith(999, "octocat/hello-world", "auth");
  });

  it("returns 429 when GitHub rate-limits the search", async () => {
    mockRepositoryFindUnique.mockResolvedValue({
      id: REPO_ID,
      fullName: "octocat/hello-world",
      installation: { userId: "user-1", active: true, installationId: BigInt(999) },
    });
    const { GithubAppApiError } = await import("./githubAppApi.js");
    mockSearchRepositoryIssuesAndPullRequests.mockRejectedValue(new GithubAppApiError("GitHub search is rate-limited"));

    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=auth`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(429);
  });

  it("never exposes the installation access token or App private key in the response", async () => {
    mockRepositoryFindUnique.mockResolvedValue({
      id: REPO_ID,
      fullName: "octocat/hello-world",
      installation: { userId: "user-1", active: true, installationId: BigInt(999) },
    });
    mockSearchRepositoryIssuesAndPullRequests.mockResolvedValue([]);

    const token = signToken("user-1");
    const res = await request(app)
      .get(`/github/app/repositories/${REPO_ID}/search?q=auth`)
      .set("Cookie", [`token=${token}`]);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/token/i);
    expect(raw).not.toMatch(/private_key/i);
  });
});
