-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "defaultOutreachTime" TEXT NOT NULL DEFAULT '11:00',
ADD COLUMN     "outreachTimezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "lastRetryAt" TIMESTAMP(3),
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "lastOutreachDate" DATE,
ADD COLUMN     "nextScheduledOutreachAt" TIMESTAMP(3),
ADD COLUMN     "outreachDeliveryTime" TEXT;

-- CreateTable
CREATE TABLE "IntegrationWebhook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerWebhookId" TEXT,
    "webhookUrl" TEXT,
    "encryptedSigningSecret" TEXT,
    "encryptedVerifyToken" TEXT,
    "eventsSubscribed" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "providerMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationWebhook_webhookToken_key" ON "IntegrationWebhook"("webhookToken");

-- CreateIndex
CREATE INDEX "IntegrationWebhook_tenantId_idx" ON "IntegrationWebhook"("tenantId");

-- CreateIndex
CREATE INDEX "IntegrationWebhook_webhookToken_idx" ON "IntegrationWebhook"("webhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationWebhook_tenantId_provider_key" ON "IntegrationWebhook"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_scheduledFor_idx" ON "CommunicationLog"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_nextRetryAt_idx" ON "CommunicationLog"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "Prospect_campaignId_nextScheduledOutreachAt_idx" ON "Prospect"("campaignId", "nextScheduledOutreachAt");

-- AddForeignKey
ALTER TABLE "IntegrationWebhook" ADD CONSTRAINT "IntegrationWebhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
