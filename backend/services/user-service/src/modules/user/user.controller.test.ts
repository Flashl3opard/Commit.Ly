import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

process.env.JWT_SECRET ??= "test-secret-for-vitest";
process.env.CLIENT_ORIGIN ??= "http://localhost:3000";
process.env.INTERNAL_SERVICE_SECRET ??= "test-internal-secret";

const mockGetPrivateUserById = vi.fn();

vi.mock("./user.service", () => ({
  getPrivateUserById: (...args: unknown[]) => mockGetPrivateUserById(...args),
  updateUserProfile: vi.fn(),
  getPublicProfileById: vi.fn(),
}));

function signToken(userId: string, expiresIn: string | number = "1h") {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

describe("GET /users/me (protected)", () => {
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

  it("returns 401 with no session cookie", async () => {
    const res = await request(app).get("/users/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed cookie", async () => {
    const res = await request(app).get("/users/me").set("Cookie", ["token=garbage"]);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const expired = signToken("user-1", -10);
    const res = await request(app).get("/users/me").set("Cookie", [`token=${expired}`]);
    expect(res.status).toBe(401);
  });

  it("returns the user for a valid session", async () => {
    mockGetPrivateUserById.mockResolvedValue({
      id: "user-42",
      username: "yash",
      displayName: "Yash",
      email: "yash@example.com",
      avatarUrl: null,
      bio: null,
      role: null,
      location: null,
      customStatus: null,
      githubUsername: null,
      githubVerified: false,
      profileCompleted: true,
      skills: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signToken("user-42");

    const res = await request(app).get("/users/me").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-42");
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});
