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

const mockGetGithubIdentity = vi.fn();

vi.mock("../github/userServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../github/userServiceClient.js")>(
    "../github/userServiceClient.js",
  );
  return {
    ...actual,
    getGithubIdentity: (...args: unknown[]) => mockGetGithubIdentity(...args),
  };
});

const mockGetAppInstallation = vi.fn();
const mockGetInstallationRepositories = vi.fn();

vi.mock("./githubAppApi", async () => {
  const actual = await vi.importActual<typeof import("./githubAppApi.js")>("./githubAppApi.js");
  return {
    ...actual,
    getAppInstallation: (...args: unknown[]) => mockGetAppInstallation(...args),
    getInstallationRepositories: (...args: unknown[]) => mockGetInstallationRepositories(...args),
  };
});

const mockFindFirstInstallation = vi.fn();
const mockFindManyRepositories = vi.fn();
const mockFindUniqueInstallation = vi.fn();
const mockUpsertInstallation = vi.fn();
const mockUpsertRepository = vi.fn();
const mockTransaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));

vi.mock("../../config/prisma", () => ({
  prisma: {
    githubInstallation: {
      findFirst: (...args: unknown[]) => mockFindFirstInstallation(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueInstallation(...args),
      upsert: (...args: unknown[]) => mockUpsertInstallation(...args),
    },
    githubRepository: {
      findMany: (...args: unknown[]) => mockFindManyRepositories(...args),
      upsert: (...args: unknown[]) => mockUpsertRepository(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...(args as [unknown[]])),
  },
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

describe("GitHub App routes", () => {
  let app: ReturnType<typeof express>;

  beforeAll(async () => {
    const appModule = (await import("../../app.js")) as unknown as { default: ReturnType<typeof express> };
    app = appModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /github/app/install", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/github/app/install");
      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const expired = signToken("user-1", -10);
      const res = await request(app).get("/github/app/install").set("Cookie", [`token=${expired}`]);
      expect(res.status).toBe(401);
    });

    it("returns 400 if GitHub identity is not verified", async () => {
      mockGetGithubIdentity.mockResolvedValue({ githubId: null, githubUsername: null, githubVerified: false });
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(400);
    });

    it("redirects to the GitHub App installation page with a state param for a verified user", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(
        /^https:\/\/github\.com\/apps\/commitly-test\/installations\/new\?state=/,
      );
    });
  });

  describe("GET /github/app/callback", () => {
    it("redirects with error for a missing state", async () => {
      const res = await request(app).get("/github/app/callback").query({ installation_id: "999" });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("github_app=error");
    });

    it("redirects with error for an invalid/expired state", async () => {
      const res = await request(app)
        .get("/github/app/callback")
        .query({ installation_id: "999", state: "not-a-real-state" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("github_app=error");
      expect(res.headers.location).toContain("reason=invalid_state");
    });

    it("redirects with error when installation_id is missing", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");
      const installRes = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
      const state = new URL(installRes.headers.location).searchParams.get("state");

      const res = await request(app).get("/github/app/callback").query({ state: state! });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("reason=missing_installation");
    });

    it("stores a valid installation and its repositories, then redirects success", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");
      const installRes = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
      const state = new URL(installRes.headers.location).searchParams.get("state");

      mockGetAppInstallation.mockResolvedValue({
        installationId: 999,
        accountLogin: "octocat",
        accountId: 12345,
        accountType: "User",
        suspended: false,
      });
      mockFindUniqueInstallation.mockResolvedValue(null);
      mockUpsertInstallation.mockResolvedValue({ id: "installation-uuid-1" });
      mockGetInstallationRepositories.mockResolvedValue([
        {
          githubRepositoryId: 1,
          name: "my-project",
          fullName: "octocat/my-project",
          ownerLogin: "octocat",
          ownerId: 12345,
          private: true,
          defaultBranch: "main",
          htmlUrl: "https://github.com/octocat/my-project",
        },
      ]);

      const res = await request(app)
        .get("/github/app/callback")
        .query({ installation_id: "999", state: state! });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("github_app=success");
      expect(mockUpsertInstallation).toHaveBeenCalledTimes(1);
    });

    it("rejects a personal installation whose account does not match the user's verified githubId", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");
      const installRes = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
      const state = new URL(installRes.headers.location).searchParams.get("state");

      mockGetAppInstallation.mockResolvedValue({
        installationId: 999,
        accountLogin: "someone-else",
        accountId: 99999,
        accountType: "User",
        suspended: false,
      });

      const res = await request(app)
        .get("/github/app/callback")
        .query({ installation_id: "999", state: state! });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("reason=verification_failed");
      expect(mockUpsertInstallation).not.toHaveBeenCalled();
    });

    it("is single-use: replaying the same state fails the second time", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");
      const installRes = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
      const state = new URL(installRes.headers.location).searchParams.get("state")!;

      mockGetAppInstallation.mockResolvedValue({
        installationId: 999,
        accountLogin: "octocat",
        accountId: 12345,
        accountType: "User",
        suspended: false,
      });
      mockFindUniqueInstallation.mockResolvedValue(null);
      mockUpsertInstallation.mockResolvedValue({ id: "installation-uuid-1" });
      mockGetInstallationRepositories.mockResolvedValue([]);

      const first = await request(app).get("/github/app/callback").query({ installation_id: "999", state });
      expect(first.headers.location).toContain("github_app=success");

      const second = await request(app).get("/github/app/callback").query({ installation_id: "999", state });
      expect(second.headers.location).toContain("reason=invalid_state");
    });

    it("rejects an installation already linked to a different Commit.ly user", async () => {
      mockGetGithubIdentity.mockResolvedValue({
        githubId: "12345",
        githubUsername: "octocat",
        githubVerified: true,
      });
      const token = signToken("user-42");
      const installRes = await request(app).get("/github/app/install").set("Cookie", [`token=${token}`]);
      const state = new URL(installRes.headers.location).searchParams.get("state");

      mockGetAppInstallation.mockResolvedValue({
        installationId: 999,
        accountLogin: "octocat",
        accountId: 12345,
        accountType: "User",
        suspended: false,
      });
      mockFindUniqueInstallation.mockResolvedValue({ id: "installation-uuid-1", userId: "some-other-user" });

      const res = await request(app)
        .get("/github/app/callback")
        .query({ installation_id: "999", state: state! });

      expect(res.headers.location).toContain("reason=verification_failed");
      expect(mockUpsertInstallation).not.toHaveBeenCalled();
    });

    it("handles setup_action=uninstall by redirecting success without touching state", async () => {
      const res = await request(app).get("/github/app/callback").query({ setup_action: "uninstall" });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("github_app=success");
    });
  });

  describe("GET /github/app/status", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/github/app/status");
      expect(res.status).toBe(401);
    });

    it("returns installed: false when there is no installation", async () => {
      mockFindFirstInstallation.mockResolvedValue(null);
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/status").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ installed: false, installation: null });
    });

    it("returns installed: true with account summary when present", async () => {
      mockFindFirstInstallation.mockResolvedValue({
        accountLogin: "octocat",
        accountType: "User",
      });
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/status").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        installed: true,
        installation: { accountLogin: "octocat", accountType: "User" },
      });
    });

    it("never includes private key, tokens, or secrets in the response", async () => {
      mockFindFirstInstallation.mockResolvedValue({ accountLogin: "octocat", accountType: "User" });
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/status").set("Cookie", [`token=${token}`]);
      const raw = JSON.stringify(res.body);

      expect(raw).not.toMatch(/private/i);
      expect(raw).not.toMatch(/secret/i);
      expect(raw).not.toMatch(/token/i);
    });
  });

  describe("GET /github/app/repositories", () => {
    it("returns 401 with no session cookie", async () => {
      const res = await request(app).get("/github/app/repositories");
      expect(res.status).toBe(401);
    });

    it("returns only safe repository fields", async () => {
      mockFindManyRepositories.mockResolvedValue([
        {
          id: "repo-uuid-1",
          name: "my-project",
          fullName: "octocat/my-project",
          private: true,
          defaultBranch: "main",
          htmlUrl: "https://github.com/octocat/my-project",
          githubRepositoryId: BigInt(1),
          ownerId: BigInt(12345),
        },
      ]);
      const token = signToken("user-42");

      const res = await request(app).get("/github/app/repositories").set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        repositories: [
          {
            id: "repo-uuid-1",
            name: "my-project",
            fullName: "octocat/my-project",
            private: true,
            defaultBranch: "main",
            htmlUrl: "https://github.com/octocat/my-project",
          },
        ],
      });
    });
  });
});
