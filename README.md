# Commit.ly

Chat rooms scoped to your GitHub repositories.

Commit.ly (formerly GitSpace) is a Discord/Slack-style chat app where each room maps to a real GitHub repo. Teams get real-time chat plus system messages for repo activity — PRs, issues, pushes — without leaving the conversation.

## Status

Actively rebuilt from scratch, service by service. Each backend service is built fully before moving to the next.

- [x] Auth service (username/email/password)
- [ ] User service (profile, custom status, presence)
- [ ] Room service (create/join, 6-digit code + password)
- [ ] GitHub App integration / webhook service
- [ ] Chat/message service (send, edit, reply, react, pin, delete)
- [ ] Presence service (online/offline, typing indicators)

## Tech stack

| Layer     | Tech                          |
|-----------|--------------------------------|
| Frontend  | Next.js                        |
| Backend   | Express.js (TypeScript)        |
| Database  | PostgreSQL + Prisma ORM (v6)   |
| Auth      | bcrypt + JWT (httpOnly cookie) |

## Project structure

```
Commit.ly/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/          # PrismaClient singleton, etc.
│   │   ├── modules/         # one folder per service (auth, user, room, ...)
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   └── .env
├── frontend/
│   └── ...                  # Next.js app
└── system-design.md         # architecture notes, flow diagrams
```

## Getting started

### Prerequisites
- Node.js 24+
- PostgreSQL running locally (or a connection string to a hosted instance)

### Backend setup
```bash
cd backend
npm install
```

Create `backend/.env`:
```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<database>?schema=public"
JWT_SECRET=<random-long-string>
JWT_EXPIRES_IN=7d
```

Run migrations:
```bash
npx prisma migrate dev
```

Start the server:
```bash
npm run dev
```

### Frontend setup
```bash
cd frontend
npm install
npm run dev
```

## Feature roadmap

**Phase 1 (MVP)** — GitHub OAuth, repo-scoped rooms, real-time chat (edit/reply/react/pin/delete), presence (online/offline, typing, last seen), custom status, GitHub App integration, webhooks → system messages for PR/issue/push events

**Phase 2** — Threads, code-snippet messages with syntax highlighting, GitHub link unfurling, @mentions, room activity feed

**Phase 3** — Contributions/leaderboard, GitHub Actions/CI status, Commit.ly bot with slash commands, Postgres full-text search

**Phase 4** — Project memory, code-level discussions, developer dashboard, VS Code extension

**Phase 5** — Commit.ly AI — a project-aware assistant for PRs/issues/CI

## Key design decisions

- Room access is a public 6-digit numeric code (like a Discord invite) + a hashed password gating actual entry
- Creating a room requires a GitHub-linked repo whose owner matches the authenticated user
- GitHub App integration is required for MVP repo rooms — no manual webhook setup, no polling fallback for v1
- Out of scope for v1: voice/video calls, multiple Git providers, AI features

## Branching convention

Feature-per-branch, e.g. `feature/auth-service`, `feature/room-service`. No direct commits of generated code without review.

## License

MIT (or update as needed)