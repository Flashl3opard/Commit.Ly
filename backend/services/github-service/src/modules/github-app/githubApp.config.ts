// GitHub App configuration is optional at startup: the service must boot
// (and GitHub OAuth must keep working) even if the GitHub App has not been
// configured yet. Missing values are surfaced via isGithubAppConfigured()
// and checked at the point of use, never at module-load time.

const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET;
const GITHUB_APP_CALLBACK_URL = process.env.GITHUB_APP_CALLBACK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!FRONTEND_URL) throw new Error("FRONTEND_URL environment variable is not set");

// The PEM key is stored as a single env-var line with literal "\n" sequences
// (standard practice, since real newlines don't survive most .env loaders).
function normalizePrivateKey(rawKey: string): string {
  return rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
}

type GithubAppConfig = {
  appId: string | undefined;
  slug: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  privateKey: string | undefined;
  webhookSecret: string | undefined;
  callbackUrl: string | undefined;
  frontendUrl: string;
  installUrl: string | undefined;
};

export const githubAppConfig: GithubAppConfig = {
  appId: GITHUB_APP_ID,
  slug: GITHUB_APP_SLUG,
  clientId: GITHUB_APP_CLIENT_ID,
  clientSecret: GITHUB_APP_CLIENT_SECRET,
  privateKey: GITHUB_APP_PRIVATE_KEY ? normalizePrivateKey(GITHUB_APP_PRIVATE_KEY) : undefined,
  webhookSecret: GITHUB_APP_WEBHOOK_SECRET,
  callbackUrl: GITHUB_APP_CALLBACK_URL,
  frontendUrl: FRONTEND_URL,
  installUrl: GITHUB_APP_SLUG ? `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new` : undefined,
};

/**
 * True only when every value required to perform GitHub App operations
 * (installation lookup, App JWT signing, installation redirects) is
 * present. Partial configuration is treated the same as no configuration —
 * operations must never proceed with some but not all credentials.
 */
export function isGithubAppConfigured(): boolean {
  return Boolean(
    githubAppConfig.appId &&
      githubAppConfig.slug &&
      githubAppConfig.clientId &&
      githubAppConfig.clientSecret &&
      githubAppConfig.privateKey &&
      githubAppConfig.webhookSecret &&
      githubAppConfig.callbackUrl,
  );
}

/**
 * Narrowed view of githubAppConfig with all fields guaranteed present.
 * Only call after isGithubAppConfigured() has returned true.
 */
export type ConfiguredGithubApp = {
  appId: string;
  slug: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webhookSecret: string;
  callbackUrl: string;
  frontendUrl: string;
  installUrl: string;
};

export function getConfiguredGithubApp(): ConfiguredGithubApp {
  if (!isGithubAppConfigured()) {
    throw new Error("getConfiguredGithubApp() called while GitHub App is not configured");
  }
  return githubAppConfig as ConfiguredGithubApp;
}
