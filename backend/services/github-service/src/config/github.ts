const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

if (!GITHUB_CLIENT_ID) {
  throw new Error("GITHUB_CLIENT_ID environment variable is not set");
}
if (!GITHUB_CLIENT_SECRET) {
  throw new Error("GITHUB_CLIENT_SECRET environment variable is not set");
}
if (!GITHUB_CALLBACK_URL) {
  throw new Error("GITHUB_CALLBACK_URL environment variable is not set");
}

export const githubConfig = {
  clientId: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackUrl: GITHUB_CALLBACK_URL,
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userApiUrl: "https://api.github.com/user",
  // Read-only identity scope only — no repo/write access requested.
  scope: "read:user",
};
