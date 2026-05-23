-- AlterTable: add userId (denormalized tenant key from Campaign.userId)
ALTER TABLE "CommunicationLog" ADD COLUMN "userId" TEXT;

-- Backfill from Campaign
UPDATE "CommunicationLog" cl
SET "userId" = c."userId"
FROM "Campaign" c
WHERE c.id = cl."campaignId";

-- Enforce NOT NULL after backfill
ALTER TABLE "CommunicationLog" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CommunicationLog_userId_idx" ON "CommunicationLog"("userId");

-- CreateIndex
CREATE INDEX "CommunicationLog_userId_sentAt_idx" ON "CommunicationLog"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
