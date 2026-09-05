# Chat Service

REST-only foundation for Commit.ly room messaging. Port 4004. No
WebSockets, presence, or realtime transport yet — see "Future work" below.

## Ownership

Chat Service owns **only** `Message` rows. It does not own rooms or users,
and does not duplicate `RoomMember` data — every request is authorized by
calling Room Service's internal membership endpoint over HTTP
(`GET /internal/rooms/:roomId/members/:userId`), even though both services
share the same physical Postgres database. `Message.roomId`/`userId` are
plain string fields, not Prisma relations, so deleting a Room or User never
cascades into chat history.

## Authentication

Identical pattern to every other Commit.ly service: `authMiddleware` reads
the `token` HttpOnly cookie, verifies it with the shared `JWT_SECRET`, and
attaches `req.user = { id }`. Chat Service never calls Auth Service
directly and never reads a token from anywhere but the cookie.

## API

All routes require authentication.

| Method | Path | Description |
|---|---|---|
| `POST` | `/rooms/:roomId/messages` | Send a message. Body: `{ content }`. Requires current room membership. |
| `GET` | `/rooms/:roomId/messages` | Cursor-paginated history. Query: `?limit` (default 50, max 100), `?before` (cursor). Requires current room membership. |
| `PATCH` | `/messages/:messageId` | Edit a message. Body: `{ content }`. Author + current room member only. |
| `DELETE` | `/messages/:messageId` | Soft-delete a message. Author + current room member only. |
| `GET` | `/health` | `{ "status": "ok" }` |

### Authorization rules

| Action | Requirement |
|---|---|
| Read history | current room member |
| Send message | current room member |
| Edit message | message author **and** current room member |
| Delete message | message author **and** current room member |

Being a room member is never sufficient on its own to edit or delete
someone else's message. `userId` always comes from the verified JWT —
never from the request body — and `.strict()` validation rejects any
attempt to submit `userId`, `createdAt`, `roomId`, etc. in the body.

### Pagination

Cursor-based, not offset-based. The cursor is an opaque base64url string
wrapping a message's `sequence` (a `BigInt @default(autoincrement())`
column used purely for deterministic ordering — `createdAt` alone can
collide at millisecond precision under concurrent sends).

- Internally, a page is fetched newest-first (`ORDER BY sequence DESC`).
- The response returns that page **oldest → newest**, so it can be
  rendered or prepended directly without client-side re-sorting.
- `before=<cursor>` means "messages strictly older than this cursor."
  Following `nextCursor` repeatedly walks backward toward the room's
  oldest message.
- `nextCursor` is `null` once there are no older messages left.
- An invalid/unparseable cursor returns `400`, never a crash.

### Deleted-message behavior (soft delete / tombstone)

`DELETE` never removes the row — it sets `deletedAt` only. This is a
deliberate, consistent policy:

- `GET` history still returns the message, with `content: null`. All other
  fields (`id`, `roomId`, `userId`, `createdAt`, `editedAt`, `deletedAt`)
  are preserved so a future realtime layer can synchronize the deletion
  event to other clients.
- `PATCH` on an already-deleted message returns `404` (not resurrectable).
- `DELETE` on an already-deleted message also returns `404` — deleting is
  **not idempotent**. This was a deliberate choice over a 200: a second
  delete attempt on a message that's already gone is treated the same as
  a delete attempt on a message that never existed, and the API doesn't
  distinguish the two to callers.
- The original `content` is never returned by any endpoint once
  `deletedAt` is set, at the DTO layer (`toSafeMessage`), not just in the
  delete response — so even history/read paths can't leak it.

## User information

Message responses return only `userId`, never enriched sender profile
data (avatar, display name, etc.). Enriching every message with a
User Service lookup would be an N+1 request pattern at read time; the
frontend should resolve `userId` → profile using existing User Service
data it likely already has cached (e.g. room member lists), rather than
Chat Service doing per-message lookups. A batched user-lookup strategy
can be added later if this becomes a real bottleneck.

## Rate limiting

Not implemented. No rate-limiting infrastructure exists anywhere in the
backend yet (no Redis, no in-memory limiter). This is a known gap and a
later hardening step — flagged here rather than solved with an ad hoc
in-process limiter or a new dependency.

## Environment variables

See `.env.example`:

```
PORT=4004
JWT_SECRET=...
CLIENT_ORIGIN=http://localhost:3000
INTERNAL_SERVICE_SECRET=...
ROOM_SERVICE_URL=http://localhost:4003
```

## Future work (explicitly out of scope for this phase)

- WebSocket/realtime delivery of new messages, edits, and deletions
- Presence, typing indicators
- Reactions, threads, DMs
- File/image attachments
- Message search
- Rate limiting
- Batched sender-profile enrichment
