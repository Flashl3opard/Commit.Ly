import type { Request, Response } from "express";
import { githubConfig } from "../../config/github";
import { generateCodeVerifier, deriveCodeChallenge } from "../../utils/pkce";
import { createOAuthState, consumeOAuthState } from "./oauthState.store";
import { exchangeCodeForToken, fetchGithubIdentity, GithubApiError } from "./githubApi";
import {
  linkGithubIdentity,
  unlinkGithubIdentity,
  getGithubLinkState,
  UserServiceError,
} from "./userServiceClient";

const FRONTEND_ORIGIN = process.env.CLIENT_ORIGIN;

if (!FRONTEND_ORIGIN) {
  throw new Error("CLIENT_ORIGIN environment variable is not set");
}

const ONBOARDING_RETURN_URL = `${FRONTEND_ORIGIN}/onboarding?github=`;
const PROFILE_RETURN_URL = `${FRONTEND_ORIGIN}/profile?github=`;

function returnUrl(from: string, outcome: "success" | "error" | "denied"): string {
  // Send the user back to onboarding if that's where they started; otherwise profile.
  const base = from === "onboarding" ? ONBOARDING_RETURN_URL : PROFILE_RETURN_URL;
  return `${base}${outcome}`;
}

export async function connect(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const state = createOAuthState(userId, codeVerifier);

  const from = typeof req.query.from === "string" ? req.query.from : "";
  const stateWithReturn = from === "onboarding" ? `${state}.onboarding` : state;

  const authorizeUrl = new URL(githubConfig.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", githubConfig.clientId);
  authorizeUrl.searchParams.set("redirect_uri", githubConfig.callbackUrl);
  authorizeUrl.searchParams.set("scope", githubConfig.scope);
  authorizeUrl.searchParams.set("state", stateWithReturn);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("allow_signup", "true");

  return res.redirect(authorizeUrl.toString());
}

export async function callback(req: Request, res: Response) {
  const { code, state: rawState, error: githubError } = req.query;

  const from = typeof rawState === "string" && rawState.endsWith(".onboarding") ? "onboarding" : "";
  const state = typeof rawState === "string" ? rawState.replace(/\.onboarding$/, "") : "";

  const fail = (outcome: "error" | "denied") => res.redirect(returnUrl(from, outcome));

  if (githubError) {
    // User denied authorization or GitHub returned an OAuth error.
    return fail("denied");
  }

  if (typeof code !== "string" || !code || typeof rawState !== "string" || !rawState) {
    return fail("error");
  }

  const stateEntry = consumeOAuthState(state);
  if (!stateEntry) {
    // Missing, expired, or already-used state — reject rather than guess the user.
    return fail("error");
  }

  try {
    const accessToken = await exchangeCodeForToken(code, stateEntry.codeVerifier);
    const identity = await fetchGithubIdentity(accessToken);
    // accessToken is discarded here — never persisted, never returned to the browser.

    await linkGithubIdentity(stateEntry.userId, identity.githubId, identity.githubUsername);

    return res.redirect(returnUrl(from, "success"));
  } catch (err) {
    if (err instanceof UserServiceError && err.status === 409) {
      return res.redirect(`${returnUrl(from, "error")}&reason=already_linked`);
    }
    if (err instanceof GithubApiError || err instanceof UserServiceError) {
      return fail("error");
    }
    throw err;
  }
}

export async function status(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const cookieHeader = req.headers.cookie ?? "";
    const user = await getGithubLinkState(cookieHeader);

    if (!user.githubVerified || !user.githubUsername) {
      return res.status(200).json({ connected: false, github: null, verified: false });
    }

    return res.status(200).json({
      connected: true,
      github: { username: user.githubUsername },
      verified: true,
    });
  } catch (err) {
    if (err instanceof UserServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}

export async function disconnect(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await unlinkGithubIdentity(userId);
    return res.status(200).json({ connected: false, github: null, verified: false });
  } catch (err) {
    if (err instanceof UserServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}
