# Microservices Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single `backend/` Express app into an npm-workspaces monorepo with `services/auth-service` (the existing auth app, unchanged in behavior) and `packages/db` (shared Prisma client), so future microservices have a place to land.

**Architecture:** Root `package.json` declares npm workspaces over `services/*` and `packages/*`. `packages/db` owns the Prisma schema/migrations and exports a `PrismaClient` singleton as `@commitly/db`. `services/auth-service` is the current `backend/` app moved wholesale, with its Prisma import repointed at `@commitly/db`. No route, controller, or service logic changes — this is a structural move.

**Tech Stack:** Node.js, TypeScript, Express 5, Prisma 6, npm workspaces.

**Spec:** [docs/superpowers/specs/2026-08-31-microservices-restructure-design.md](../specs/2026-08-31-microservices-restructure-design.md)

## Global Constraints

- No behavior change to auth routes, validation, or JWT/cookie logic.
- `packages/db` owns `prisma/schema.prisma`, `prisma/migrations/`, and `DATABASE_URL`.
- `services/auth-service` owns `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CLIENT_ORIGIN`.
- `jwt.ts` and `authMiddleware.ts` stay inside `auth-service` — do not create a shared auth package in this plan.
- Use `git mv` for file moves so history is preserved, not delete+recreate.
- `backend/` is deleted only after the moved app is verified working (Task 4).

---

### Task 1: Scaffold workspaces and move `packages/db`

**Files:**
- Create: `package.json` (root)
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/.env`
- Create: `packages/db/.gitignore`
- Move: `backend/prisma/schema.prisma` → `packages/db/prisma/schema.prisma`
- Move: `backend/prisma/migrations/` → `packages/db/prisma/migrations/`
- Move: `backend/prisma.config.ts` → `packages/db/prisma.config.ts`

**Interfaces:**
- Produces: `@commitly/db` package exporting `prisma: PrismaClient` (named export) from `packages/db/src/index.ts`. Later tasks import it as `import { prisma } from "@commitly/db"`.

- [ ] **Step 1: Create root `package.json` with workspaces**

```json
{
  "name": "commitly",
  "private": true,
  "version": "1.0.0",
  "workspaces": [
    "services/*",
    "packages/*"
  ],
  "scripts": {
    "dev:auth": "npm run dev -w services/auth-service"
  }
}
```

- [ ] **Step 2: Move the Prisma schema, migrations, and config with git mv**

```bash
mkdir -p packages/db/prisma
git mv backend/prisma/schema.prisma packages/db/prisma/schema.prisma
git mv backend/prisma/migrations packages/db/prisma/migrations
git mv backend/prisma.config.ts packages/db/prisma.config.ts
```

- [ ] **Step 3: Create `packages/db/package.json`**

```json
{
  "name": "@commitly/db",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3"
  },
  "devDependencies": {
    "prisma": "^6.19.3",
    "dotenv": "^17.4.2",
    "typescript": "^7.0.2",
    "@types/node": "^26.4.0"
  }
}
```

- [ ] **Step 4: Create `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create `packages/db/src/index.ts` (PrismaClient singleton, moved logic from `backend/src/config/prisma.ts`)**

```typescript
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaClient: PrismaClient | undefined;
}

export const prisma = globalThis.prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
```

- [ ] **Step 6: Create `packages/db/.env` with `DATABASE_URL` (copy value from `backend/.env`)**

```
DATABASE_URL="postgresql://postgres:yash123@localhost:5432/commitly?schema=public"
```

- [ ] **Step 7: Create `packages/db/.gitignore`**

```
node_modules/
.env
.env.*
!.env.example
dist/
```

- [ ] **Step 8: Delete the now-empty `backend/src/config/prisma.ts` (logic moved to `packages/db/src/index.ts`)**

```bash
git rm backend/src/config/prisma.ts
```

- [ ] **Step 9: Commit**

```bash
git add package.json packages/db
git commit -m "Scaffold npm workspaces and move Prisma into packages/db"
```

---

### Task 2: Move auth app into `services/auth-service`

**Files:**
- Create: `services/auth-service/package.json`
- Create: `services/auth-service/tsconfig.json`
- Create: `services/auth-service/.env`
- Move: `backend/src/app.ts` → `services/auth-service/src/app.ts`
- Move: `backend/src/server.ts` → `services/auth-service/src/server.ts`
- Move: `backend/src/middleware/authMiddleware.ts` → `services/auth-service/src/middleware/authMiddleware.ts`
- Move: `backend/src/utils/jwt.ts` → `services/auth-service/src/utils/jwt.ts`
- Move: `backend/src/modules/auth/*` → `services/auth-service/src/modules/auth/*`
- Move: `backend/system-design.md` → `services/auth-service/system-design.md`
- Modify: `services/auth-service/src/modules/auth/auth.service.ts` (repoint Prisma import)

**Interfaces:**
- Consumes: `@commitly/db`'s `prisma` export (from Task 1).
- Produces: no new interfaces — same Express app shape (`app.ts` default export, mounted at `/auth` + `/health`).

- [ ] **Step 1: Move files with git mv, preserving directory structure**

```bash
mkdir -p services/auth-service/src
git mv backend/src/app.ts services/auth-service/src/app.ts
git mv backend/src/server.ts services/auth-service/src/server.ts
git mv backend/src/middleware services/auth-service/src/middleware
git mv backend/src/utils services/auth-service/src/utils
git mv backend/src/modules services/auth-service/src/modules
git mv backend/system-design.md services/auth-service/system-design.md
```

- [ ] **Step 2: Update the Prisma import in `auth.service.ts`**

In `services/auth-service/src/modules/auth/auth.service.ts`, change:

```typescript
import { prisma } from "../../config/prisma";
```

to:

```typescript
import { prisma } from "@commitly/db";
```

- [ ] **Step 3: Create `services/auth-service/package.json`**

```json
{
  "name": "@commitly/auth-service",
  "version": "1.0.0",
  "description": "",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "@commitly/db": "*",
    "bcrypt": "^6.0.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@prisma/client": "^6.19.3",
    "@types/bcrypt": "^6.0.0",
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^26.4.0",
    "tsx": "^4.23.13",
    "typescript": "^7.0.2"
  },
  "allowScripts": {
    "bcrypt@6.0.0": true
  }
}
```

- [ ] **Step 4: Create `services/auth-service/tsconfig.json` (same compiler options as the old `backend/tsconfig.json`)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create `services/auth-service/.env` (copy JWT/PORT/CLIENT_ORIGIN values from `backend/.env`)**

```
PORT=4000
NODE_ENV=development
JWT_SECRET=commitly-local-dev-secret-change-this
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Commit**

```bash
git add services/auth-service
git commit -m "Move auth app into services/auth-service"
```

---

### Task 3: Remove old `backend/` scaffolding and install

**Files:**
- Delete: `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`, `backend/.env`, `backend/.gitignore` (remaining backend files after Tasks 1-2 moved the rest)
- Modify: root `.gitignore` (ensure `node_modules/`, `dist/`, `.env` patterns are covered at root if not already)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — cleanup only.

- [ ] **Step 1: Verify `backend/` only has leftover config files (no src left)**

```bash
find backend -type f
```

Expected: only `package.json`, `package-lock.json`, `tsconfig.json`, `.env`, `.gitignore`, and `node_modules/` (untracked, ignore it).

- [ ] **Step 2: Remove the leftover backend files**

```bash
git rm backend/package.json backend/package-lock.json backend/tsconfig.json backend/.gitignore
rm -f backend/.env
rm -rf backend/node_modules
rmdir backend 2>/dev/null || true
```

- [ ] **Step 3: Check root `.gitignore` exists and covers `node_modules/`, `.env`, `dist/`; create/append if missing**

If no root `.gitignore` exists, create one:

```
node_modules/
dist/
.env
.env.*
!.env.example
```

- [ ] **Step 4: Install dependencies from the root**

```bash
npm install
```

Expected: installs and links `@commitly/db` into `services/auth-service/node_modules/@commitly/db` via the workspace symlink, no errors.

- [ ] **Step 5: Generate the Prisma client**

```bash
npm run generate -w packages/db
```

Expected: "Generated Prisma Client" success message.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove old backend/ scaffolding after workspace move"
```

---

### Task 4: Verify auth-service runs end-to-end

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: the running `services/auth-service` dev server on `PORT` (default 4000).

- [ ] **Step 1: Start the auth-service dev server**

```bash
npm run dev -w services/auth-service
```

Expected console output: `Server listening on port 4000` with no import errors (specifically no "Cannot find module '@commitly/db'").

- [ ] **Step 2: Hit the health check in a separate terminal**

```bash
curl -i http://localhost:4000/health
```

Expected: `HTTP/1.1 200 OK` with body `{"status":"ok"}`.

- [ ] **Step 3: Exercise register**

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser1","email":"testuser1@example.com","password":"password123"}'
```

Expected: `201 Created` with `{"user": {...}}` (no `passwordHash` field) and a `Set-Cookie: token=...` header.

- [ ] **Step 4: Exercise `/auth/me` using the saved cookie**

```bash
curl -i -b cookies.txt http://localhost:4000/auth/me
```

Expected: `200 OK` with the same user object.

- [ ] **Step 5: Exercise logout**

```bash
curl -i -b cookies.txt -X POST http://localhost:4000/auth/logout
```

Expected: `200 OK` with `{"message":"Logged out"}`.

- [ ] **Step 6: Clean up the test artifact and stop the dev server**

```bash
rm -f cookies.txt
```

Stop the `npm run dev` process (Ctrl+C).

- [ ] **Step 7: Final commit if any fixes were needed during verification**

```bash
git add -A
git commit -m "Fix issues found during auth-service post-move verification"
```

(Skip this commit if verification passed with no changes.)

---

## Post-plan note

The stray `cookies.txt` already sitting untracked at the repo root (visible in `git status`) is leftover from prior manual curl testing — Task 4 creates and removes its own copy but does not touch the pre-existing one. Delete or `.gitignore` it separately if it's not wanted in the repo.
