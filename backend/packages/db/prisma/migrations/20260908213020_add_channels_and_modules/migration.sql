-- CreateEnum
CREATE TYPE "RoomModuleType" AS ENUM ('CHAT', 'GITHUB_ACTIVITY', 'MEMBERS', 'TASKS', 'NOTES', 'RELEASES');

-- NOTE: Prisma's diff generated a "DROP INDEX Message_content_trgm_idx"
-- here because that index (added by hand via raw SQL in the
-- add_threads_mentions migration for full-text search performance) has
-- no representation in schema.prisma — Prisma doesn't know it exists on
-- purpose and wants to "fix" the drift. Deliberately removed: dropping it
-- would regress GET /rooms/:roomId/messages/search back to an unindexed
-- sequential scan. Left in place, untouched.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomModule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "RoomModuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Channel_roomId_position_idx" ON "Channel"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_roomId_name_key" ON "Channel"("roomId", "name");

-- CreateIndex
CREATE INDEX "RoomModule_roomId_position_idx" ON "RoomModule"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RoomModule_roomId_type_key" ON "RoomModule"("roomId", "type");

-- CreateIndex
CREATE INDEX "Message_channelId_sequence_idx" ON "Message"("channelId", "sequence");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModule" ADD CONSTRAINT "RoomModule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: every existing room gets its mandatory "general" channel,
-- and every existing message is assigned to its room's general channel.
-- Preserves all existing message ids/content/timestamps — only channelId
-- is being populated on rows that already exist. createdBy is set to the
-- room's owner (ownerUserId) since general is created "by" the room, not
-- by any specific member action.
INSERT INTO "Channel" ("id", "roomId", "name", "isDefault", "position", "createdBy", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'general', true, 0, "ownerUserId", "createdAt", "createdAt"
FROM "Room";

UPDATE "Message" m
SET "channelId" = c."id"
FROM "Channel" c
WHERE c."roomId" = m."roomId" AND c."isDefault" = true;

-- Orphaned rows: messages whose roomId no longer matches any existing
-- Room (the room was deleted — Chat Service's Message table has no FK to
-- Room by deliberate cross-service design, so this was already possible
-- before channels existed). Such a message can never be displayed by the
-- app again regardless of channelId, since its room is already gone. It
-- cannot be assigned a real Channel row either — Channel.roomId is a real
-- FK to Room, so no Channel can be created for a room that no longer
-- exists. Content/id/timestamps are preserved (nothing is deleted here);
-- only channelId is populated with a synthetic, dedicated sentinel id and
-- the row is soft-deleted via deletedAt, matching how this table already
-- represents "not shown but not destroyed."
UPDATE "Message"
SET "channelId" = '00000000-0000-0000-0000-000000000000',
    "deletedAt" = COALESCE("deletedAt", NOW())
WHERE "channelId" IS NULL;

-- Also seed the two other initial modules (Chat, GitHub Activity, Members)
-- for every existing room, so rooms created before this migration land on
-- the same default configuration as brand-new ones rather than showing an
-- empty rail. name matches the enum-derived default label the frontend
-- would otherwise assign to a freshly-created module.
INSERT INTO "RoomModule" ("id", "roomId", "type", "name", "position", "enabled", "createdBy", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'CHAT', 'Chat', 0, true, "ownerUserId", "createdAt", "createdAt"
FROM "Room";

INSERT INTO "RoomModule" ("id", "roomId", "type", "name", "position", "enabled", "createdBy", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'GITHUB_ACTIVITY', 'GitHub Activity', 1, true, "ownerUserId", "createdAt", "createdAt"
FROM "Room";

INSERT INTO "RoomModule" ("id", "roomId", "type", "name", "position", "enabled", "createdBy", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'MEMBERS', 'Members', 2, true, "ownerUserId", "createdAt", "createdAt"
FROM "Room";

-- Now that every existing message has a channelId, the column can be made
-- required — new rows are required to specify one anyway (the service
-- layer only ever inserts with channelId set from this point on).
ALTER TABLE "Message" ALTER COLUMN "channelId" SET NOT NULL;
