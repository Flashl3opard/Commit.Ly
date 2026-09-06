-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "senderType" "MessageSenderType" NOT NULL DEFAULT 'USER',
ADD COLUMN     "systemEventType" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;
