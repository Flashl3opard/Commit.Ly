# Microservices Restructure — Design

## Context

Commit.ly currently has a single `backend/` Express app containing one
module: auth. More services are planned. This restructure turns the
repo into an npm-workspaces monorepo with a `services/` folder per
microservice and a `packages/` folder for code shared across services,
starting with the Prisma database client.

## Goals

- Establish a repo layout that scales to multiple independent
  microservices without a rewrite each time one is added.
- Move the existing auth code into `services/auth-service` unchanged
  in behavior.
- Share the Prisma schema/client via a workspace package
  (`@commitly/db`) rather than duplicating it per service, since all
  services currently target one Postgres database.
- Do not extract JWT signing/verification into a shared package yet —
  only auth-service issues or checks tokens today (YAGNI). Revisit
  when a second service needs `verifyToken`/`authMiddleware`.

## Non-goals

- No Docker/orchestration setup in this pass.
- No new microservice is being built yet — this is purely the
  structural move of the existing auth code.
- No change to auth behavior, routes, or the data model.

## Top-level layout

```
Commit.ly/
├── frontend/                    (unchanged)
├── services/
│   └── auth-service/
│       ├── src/
│       │   ├── modules/auth/    (auth.routes/controller/service/validation)
│       │   ├── middleware/      (authMiddleware.ts)
│       │   ├── config/          (re-exports prisma client from @commitly/db)
│       │   ├── app.ts
│       │   └── server.ts
│       ├── system-design.md     (moved from backend/system-design.md)
│       ├── .env                 (JWT_SECRET, PORT, CLIENT_ORIGIN)
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── db/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── src/index.ts         (PrismaClient singleton, moved from backend/src/config/prisma.ts)
│       ├── prisma.config.ts
│       ├── .env                 (DATABASE_URL)
│       ├── package.json         (@commitly/db)
│       └── tsconfig.json
├── package.json                 (root; npm workspaces)
└── tsconfig.base.json           (shared compiler options, optional)
```

`backend/` is removed once the move is verified working.

## Components

**`packages/db` (`@commitly/db`)**
- Owns `prisma/schema.prisma` and migrations.
- Exports the `PrismaClient` singleton from `src/index.ts`.
- `DATABASE_URL` lives in this package's `.env` since `prisma
  migrate`/`generate` run from here.
- Depends on `@prisma/client`; has `prisma` as a dev dependency.

**`services/auth-service`**
- Express app: `app.ts` mounts `/auth` routes and `/health`.
- `auth.service.ts` imports `prisma` from `@commitly/db` instead of a
  local `config/prisma.ts`.
- Keeps its own `jwt.ts` and `authMiddleware.ts` — not shared yet.
- Owns `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CLIENT_ORIGIN` in its
  own `.env`.
- `package.json` depends on `@commitly/db` via the workspace protocol.

**Root `package.json`**
- Adds `"workspaces": ["services/*", "packages/*"]`.
- Hoists shared deps (`typescript`, `@types/node`, `@prisma/client`).
- Optionally adds convenience scripts, e.g. `dev:auth` →
  `npm run dev -w services/auth-service`.

## Data flow / dependency direction

```
services/auth-service  --depends on-->  packages/db (@commitly/db)
```

No service depends on another service directly. Future services will
each depend on `packages/db` (or their own DB package, if a service
later needs data isolation) but not on `auth-service`'s internals. If
another service needs to verify JWTs, that is the trigger to extract
`jwt.ts`/`authMiddleware.ts` into a new `packages/auth-shared`.

## Migration steps (behavioral summary, detail lives in the plan)

1. Scaffold `services/auth-service` and `packages/db`.
2. Move `backend/prisma/*` → `packages/db/prisma/*`; move
   `backend/src/config/prisma.ts` logic → `packages/db/src/index.ts`.
3. Move `backend/src/modules`, `backend/src/middleware`,
   `backend/src/utils`, `backend/src/app.ts`, `backend/src/server.ts`
   → `services/auth-service/src/...`, updating the Prisma import to
   `@commitly/db`.
4. Split `backend/.env` into `packages/db/.env` (`DATABASE_URL`) and
   `services/auth-service/.env` (the rest).
5. Move `backend/system-design.md` →
   `services/auth-service/system-design.md`.
6. Add root `package.json` with workspaces; add per-package
   `package.json`/`tsconfig.json`.
7. `npm install` at root; `npx prisma generate -w packages/db`.
8. Verify: `npm run dev -w services/auth-service`, hit `/health` and
   exercise register/login/me/logout.
9. Remove the old `backend/` directory once verified.

## Testing

No automated tests exist yet (`npm test` is a placeholder). Verification
is manual: start auth-service, confirm `/health` responds, and run
through register → login → `/auth/me` → logout to confirm Prisma
connectivity and JWT cookie flow still work identically post-move.

## Open questions for future services

- When a second service needs to verify JWTs, extract
  `jwt.ts`/`authMiddleware.ts` to `packages/auth-shared`.
- If a future service needs data isolation from the shared Postgres
  DB/schema, give it its own `packages/db-<service>` or its own schema
  namespace at that time.
