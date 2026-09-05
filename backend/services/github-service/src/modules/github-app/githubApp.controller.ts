import type { Request, Response } from "express";
import { githubAppConfig, isGithubAppConfigured } from "./githubApp.config";
import { createInstallState, consumeInstallState } from "./githubApp.installation.store";
import { GithubAppApiError } from "./githubAppApi";
import {
  assertGithubIdentityVerified,
  getInstallationStatusForUser,
  getRepositoriesForUser,
  verifyAndStoreInstallation,
  GithubAppServiceError,
} from "./githubApp.service";
import { UserServiceError } from "../github/userServiceClient";

const NOT_CONFIGURED_MESSAGE = "GitHub App is not configured.";

function sendNotConfigured(res: Response) {
  return res.status(503).json({ error: NOT_CONFIGURED_MESSAGE });
}

function redirectOutcome(res: Response, outcome: "success" | "error", reason?: string) {
  const url = new URL("/profile", githubAppConfig.frontendUrl);
  url.searchParams.set("github_app", outcome);
  if (reason) url.searchParams.set("reason", reason);
  return res.redirect(url.toString());
}

export async function install(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!isGithubAppConfigured()) {
    return sendNotConfigured(res);
  }

  try {
    await assertGithubIdentityVerified(userId);
  } catch (err) {
    if (err instanceof GithubAppServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }

  const state = createInstallState(userId);

  const installUrl = new URL(githubAppConfig.installUrl as string);
  installUrl.searchParams.set("state", state);

  return res.redirect(installUrl.toString());
}

export async function callback(req: Request, res: Response) {
  if (!isGithubAppConfigured()) {
    return sendNotConfigured(res);
  }

  const { installation_id: rawInstallationId, state, setup_action: setupAction } = req.query;

  if (setupAction === "uninstall") {
    // Nothing to verify — a future webhook will mark the installation inactive.
    return redirectOutcome(res, "success");
  }

  if (typeof state !== "string" || !state) {
    return redirectOutcome(res, "error", "invalid_state");
  }

  const stateEntry = consumeInstallState(state);
  if (!stateEntry) {
    return redirectOutcome(res, "error", "invalid_state");
  }

  if (typeof rawInstallationId !== "string" || !rawInstallationId || !/^\d+$/.test(rawInstallationId)) {
    return redirectOutcome(res, "error", "missing_installation");
  }

  const installationId = Number(rawInstallationId);

  try {
    await verifyAndStoreInstallation(stateEntry.userId, installationId);
    return redirectOutcome(res, "success");
  } catch (err) {
    if (err instanceof GithubAppServiceError) {
      return redirectOutcome(res, "error", "verification_failed");
    }
    if (err instanceof GithubAppApiError || err instanceof UserServiceError) {
      return redirectOutcome(res, "error", "github_error");
    }
    throw err;
  }
}

export async function status(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!isGithubAppConfigured()) {
    return res.status(200).json({ installed: false, installation: null });
  }

  const result = await getInstallationStatusForUser(userId);
  return res.status(200).json(result);
}

export async function repositories(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!isGithubAppConfigured()) {
    return sendNotConfigured(res);
  }

  const repos = await getRepositoriesForUser(userId);
  return res.status(200).json({ repositories: repos });
}
