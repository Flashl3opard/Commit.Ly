-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sourceEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_sourceEventId_key" ON "Message"("sourceEventId");
