import { describe, it, expect, beforeEach, vi } from "vitest";

const REQUIRED_APP_VARS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_WEBHOOK_SECRET",
  "GITHUB_APP_CALLBACK_URL",
] as const;

function clearAppEnv() {
  for (const key of REQUIRED_APP_VARS) delete process.env[key];
}

function setFullAppEnv() {
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_APP_SLUG = "commitly-test";
  process.env.GITHUB_APP_CLIENT_ID = "test-app-client-id";
  process.env.GITHUB_APP_CLIENT_SECRET = "test-app-client-secret";
  process.env.GITHUB_APP_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\\ntest\\n-----END RSA PRIVATE KEY-----";
  process.env.GITHUB_APP_WEBHOOK_SECRET = "test-app-webhook-secret";
  process.env.GITHUB_APP_CALLBACK_URL = "http://127.0.0.1:4002/github/app/callback";
}

describe("githubApp.config", () => {
  beforeEach(() => {
    vi.resetModules();
    clearAppEnv();
    process.env.FRONTEND_URL ??= "http://localhost:3000";
  });

  it("does not throw at import time when GitHub App env vars are entirely missing", async () => {
    await expect(import("./githubApp.config.js")).resolves.toBeDefined();
  });

  it("isGithubAppConfigured() returns false when config is missing", async () => {
    const { isGithubAppConfigured } = await import("./githubApp.config.js");
    expect(isGithubAppConfigured()).toBe(false);
  });

  it("isGithubAppConfigured() returns false for partial config", async () => {
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_CLIENT_ID = "test-app-client-id";
    // privateKey, slug, clientSecret, webhookSecret, callbackUrl left unset

    const { isGithubAppConfigured } = await import("./githubApp.config.js");
    expect(isGithubAppConfigured()).toBe(false);
  });

  it("isGithubAppConfigured() returns true when every required value is present", async () => {
    setFullAppEnv();

    const { isGithubAppConfigured } = await import("./githubApp.config.js");
    expect(isGithubAppConfigured()).toBe(true);
  });

  it("getConfiguredGithubApp() throws if called while not configured", async () => {
    const { getConfiguredGithubApp } = await import("./githubApp.config.js");
    expect(() => getConfiguredGithubApp()).toThrow();
  });

  it("getConfiguredGithubApp() returns the normalized config when fully configured", async () => {
    setFullAppEnv();

    const { getConfiguredGithubApp } = await import("./githubApp.config.js");
    const config = getConfiguredGithubApp();
    expect(config.appId).toBe("123456");
    expect(config.privateKey).toContain("\n");
    expect(config.installUrl).toBe("https://github.com/apps/commitly-test/installations/new");
  });

  it("still requires FRONTEND_URL (unrelated to GitHub App, but still a hard startup requirement)", async () => {
    delete process.env.FRONTEND_URL;
    await expect(import("./githubApp.config.js")).rejects.toThrow(/FRONTEND_URL/);
  });
});
