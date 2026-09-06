-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parentMessageId" TEXT,
ADD COLUMN     "replyCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Message_parentMessageId_idx" ON "Message"("parentMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigram index so ILIKE '%query%' substring search on content (used by
-- GET /rooms/:roomId/messages/search) doesn't run as a sequential scan.
-- Not expressed in schema.prisma (would require the postgresqlExtensions
-- preview feature); Prisma otherwise leaves this extension/index alone
-- since it has no model-level representation.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Message_content_trgm_idx" ON "Message" USING GIN ("content" gin_trgm_ops);
