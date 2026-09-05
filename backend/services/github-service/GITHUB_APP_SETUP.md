# GitHub App Setup

This document covers creating and configuring the Commit.ly GitHub App,
which is separate from the existing GitHub OAuth connection (`/github/connect`,
`/github/callback`, `/github/status`, `/github/disconnect`). OAuth verifies a
user's GitHub identity; the GitHub App authorizes Commit.ly to access specific
repositories.

## 1. Create the GitHub App

Go to GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
(or your organization's equivalent settings page).

| Field | Value |
|---|---|
| GitHub App name | `Commit.ly` (must be globally unique on GitHub — append a suffix locally if taken, e.g. `Commit.ly-dev`) |
| Description | GitHub-native collaboration for development teams. |
| Homepage URL | `http://localhost:3000` (use your deployed frontend URL in production) |
| Callback URL | `http://127.0.0.1:4002/github/app/callback` (must match `GITHUB_APP_CALLBACK_URL`) |
| Setup URL (optional) | Not required — GitHub redirects to the callback URL by default after installation |
| Webhook | Leave inactive for this phase (see §4 — webhooks are not implemented yet) |
| Where can this app be installed | "Only on this account" for local development is fine; use "Any account" if other users need to install it |

## 2. Permissions (least privilege)

Grant only what's needed for installation awareness and repository listing.
Do **not** enable write permissions — none are required yet.

| Permission | Access | Why |
|---|---|---|
| Repository metadata | Read-only | Required to list installed repositories and their basic info (name, owner, default branch, visibility). |
| Contents | Not requested | Not needed until Room Service reads repository content — add later, read-only, when that phase begins. |
| Pull requests | Not requested | Not needed until webhook/event integration — add later, read-only. |
| Issues | Not requested | Same as above. |
| Checks / commit statuses | Not requested | Same as above. |

Explicitly **not requested**: administration, contents write, pull requests
write, issues write, or any other write permission. This phase only reads
which repositories Commit.ly has been authorized to access.

## 3. Generate credentials

After creating the App:

1. Note the **App ID** (top of the App's settings page) → `GITHUB_APP_ID`.
2. Note the **App slug** (from the App's public URL, `github.com/apps/<slug>`) → `GITHUB_APP_SLUG`.
3. Under "Generate a private key", download the `.pem` file. Convert it to a
   single-line env value with literal `\n` sequences:
   ```
   awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-app.private-key.pem
   ```
   Paste the output as `GITHUB_APP_PRIVATE_KEY` in `.env`.
4. Under "Client secrets", generate one → `GITHUB_APP_CLIENT_SECRET`. The
   **Client ID** shown on the same page → `GITHUB_APP_CLIENT_ID`.
5. If you enable webhooks later, set a webhook secret → `GITHUB_APP_WEBHOOK_SECRET`.
   A placeholder value is fine for now since no webhook endpoint exists yet.

## 4. Required environment variables

Set these in `backend/services/github-service/.env` (see `.env.example`):

```
FRONTEND_URL=http://localhost:3000
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_WEBHOOK_SECRET=
GITHUB_APP_CALLBACK_URL=http://127.0.0.1:4002/github/app/callback
```

Never commit real values — `.env` is gitignored; only `.env.example` (with
placeholders) is tracked.

## 5. Local development

Standard local ports apply, matching the rest of Commit.ly:

- Frontend: `http://localhost:3000`
- Auth Service: `http://localhost:4000`
- User Service: `http://localhost:4001`
- GitHub Service: `http://localhost:4002`

Start each service normally (`npm run dev` in its directory, or the
project's existing dev script). No additional local tooling (tunnels,
ngrok, etc.) is required for the installation flow itself, since it's a
direct browser redirect + callback — only webhooks (not implemented yet)
would need a publicly reachable URL.

## 6. Installation flow (what happens)

1. User must have already connected GitHub OAuth (`githubVerified: true`) —
   `GET /github/app/install` returns 400 otherwise.
2. `GET /github/app/install` generates a single-use, 10-minute state value
   bound to the authenticated Commit.ly user, then redirects to
   `https://github.com/apps/<slug>/installations/new?state=...`.
3. The user picks "All repositories" or "Only select repositories" and
   installs the App.
4. GitHub redirects to `GET /github/app/callback?installation_id=...&state=...`.
5. The service validates the state (single-use, not expired), fetches the
   installation from GitHub using an App-level JWT, and — for a personal
   (non-organization) installation — verifies the installation's GitHub
   account ID matches the user's already-verified `githubId`. Organization
   installations are accepted without this specific cross-check (see
   Limitations below).
6. On success, the installation and its accessible repositories are
   persisted, and the browser is redirected to
   `${FRONTEND_URL}/profile?github_app=success`.
7. On any failure, the redirect is `${FRONTEND_URL}/profile?github_app=error&reason=...`.

## 7. How to test

See the main implementation report for full manual testing steps. In short:
connect GitHub OAuth first, then use the "Install Commit.ly on GitHub"
button on the profile page.

## 8. What's intentionally not built yet

- **Webhooks** — no event ingestion. Uninstalling the App on GitHub does not
  yet flip the stored installation to inactive; that requires the
  `installation` webhook event, planned for a later phase.
- **Organization membership verification** — an organization installation is
  accepted based on the installer having a verified personal GitHub identity,
  but Commit.ly does not yet verify the installer's role within that
  organization.
- **Repository polling** — repository lists are fetched at installation time
  only; there's no background refresh yet.
- **Room Service integration** — this phase only makes repository access
  discoverable via `GET /github/app/repositories`. Room creation from a
  repository is a separate, future phase.
