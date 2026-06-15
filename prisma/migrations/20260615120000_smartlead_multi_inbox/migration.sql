-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "smartleadInboxIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SmartleadInbox" (
    "id" TEXT NOT NULL,
    "emailIntegrationId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "sendingDomain" TEXT,
    "providerType" TEXT,
    "encryptedSmartleadAccountId" TEXT NOT NULL,
    "isSmtpSuccess" BOOLEAN,
    "isImapSuccess" BOOLEAN,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warmupStatus" TEXT,
    "warmupReputation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartleadInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartleadInbox_emailIntegrationId_idx" ON "SmartleadInbox"("emailIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartleadInbox_emailIntegrationId_fromEmail_key" ON "SmartleadInbox"("emailIntegrationId", "fromEmail");

-- AddForeignKey
ALTER TABLE "SmartleadInbox" ADD CONSTRAINT "SmartleadInbox_emailIntegrationId_fkey" FOREIGN KEY ("emailIntegrationId") REFERENCES "EmailIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single-inbox rows into SmartleadInbox
INSERT INTO "SmartleadInbox" (
    "id",
    "emailIntegrationId",
    "fromEmail",
    "fromName",
    "sendingDomain",
    "providerType",
    "encryptedSmartleadAccountId",
    "isSmtpSuccess",
    "isImapSuccess",
    "warmupEnabled",
    "warmupStatus",
    "warmupReputation",
    "status",
    "connectedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'slinbox_' || ei."id",
    ei."id",
    ei."fromEmail",
    ei."fromName",
    ei."sendingDomain",
    ei."providerType",
    ei."encryptedSmartleadAccountId",
    ei."isSmtpSuccess",
    ei."isImapSuccess",
    ei."warmupEnabled",
    ei."warmupStatus",
    ei."warmupReputation",
    ei."status",
    ei."connectedAt",
    ei."createdAt",
    ei."updatedAt"
FROM "EmailIntegration" ei
WHERE ei."encryptedSmartleadAccountId" IS NOT NULL
  AND ei."fromEmail" IS NOT NULL;
