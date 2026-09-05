const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET;
const GITHUB_APP_CALLBACK_URL = process.env.GITHUB_APP_CALLBACK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!GITHUB_APP_ID) throw new Error("GITHUB_APP_ID environment variable is not set");
if (!GITHUB_APP_SLUG) throw new Error("GITHUB_APP_SLUG environment variable is not set");
if (!GITHUB_APP_CLIENT_ID) throw new Error("GITHUB_APP_CLIENT_ID environment variable is not set");
if (!GITHUB_APP_CLIENT_SECRET) throw new Error("GITHUB_APP_CLIENT_SECRET environment variable is not set");
if (!GITHUB_APP_PRIVATE_KEY) throw new Error("GITHUB_APP_PRIVATE_KEY environment variable is not set");
if (!GITHUB_APP_WEBHOOK_SECRET) throw new Error("GITHUB_APP_WEBHOOK_SECRET environment variable is not set");
if (!GITHUB_APP_CALLBACK_URL) throw new Error("GITHUB_APP_CALLBACK_URL environment variable is not set");
if (!FRONTEND_URL) throw new Error("FRONTEND_URL environment variable is not set");

// The PEM key is stored as a single env-var line with literal "\n" sequences
// (standard practice, since real newlines don't survive most .env loaders).
function normalizePrivateKey(rawKey: string): string {
  return rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
}

export const githubAppConfig = {
  appId: GITHUB_APP_ID,
  slug: GITHUB_APP_SLUG,
  clientId: GITHUB_APP_CLIENT_ID,
  clientSecret: GITHUB_APP_CLIENT_SECRET,
  privateKey: normalizePrivateKey(GITHUB_APP_PRIVATE_KEY),
  webhookSecret: GITHUB_APP_WEBHOOK_SECRET,
  callbackUrl: GITHUB_APP_CALLBACK_URL,
  frontendUrl: FRONTEND_URL,
  installUrl: `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`,
};
