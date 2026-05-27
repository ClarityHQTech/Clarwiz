-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "calendlyBookingUrl" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "qualifiedAt" TIMESTAMP(3),
ADD COLUMN "qualifiedReason" TEXT;

-- CreateTable
CREATE TABLE "CalendlyIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "organizationUri" TEXT,
    "userUri" TEXT,
    "ownerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "webhookSubscriptionUris" JSONB,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendlyIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendlyIntegration_userId_key" ON "CalendlyIntegration"("userId");

-- AddForeignKey
ALTER TABLE "CalendlyIntegration" ADD CONSTRAINT "CalendlyIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
