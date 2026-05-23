-- CreateTable
CREATE TABLE "ProspectSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectSignal_userId_idx" ON "ProspectSignal"("userId");

-- CreateIndex
CREATE INDEX "ProspectSignal_campaignId_idx" ON "ProspectSignal"("campaignId");

-- CreateIndex
CREATE INDEX "ProspectSignal_prospectId_idx" ON "ProspectSignal"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectSignal_campaignId_prospectId_idx" ON "ProspectSignal"("campaignId", "prospectId");

-- AddForeignKey
ALTER TABLE "ProspectSignal" ADD CONSTRAINT "ProspectSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSignal" ADD CONSTRAINT "ProspectSignal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSignal" ADD CONSTRAINT "ProspectSignal_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
