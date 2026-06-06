-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('TOFU_TRANSITION', 'HUBSPOT_MQL', 'MANUAL');

-- CreateEnum
CREATE TYPE "InsightScope" AS ENUM ('DEAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "DealSignalKind" AS ENUM ('CALL_TRANSCRIPT', 'EMAIL', 'STAGE_CHANGE', 'MEETING', 'NOTE');

-- CreateEnum
CREATE TYPE "NbaActionType" AS ENUM ('SEND_EMAIL', 'SEND_MARKETING_COLLATERAL', 'SEND_SALES_COLLATERAL', 'SCHEDULE_MEETING', 'CALL_WITH_SCRIPT', 'PREP_MEETING', 'UPDATE_CRM_CREATE_TASK', 'NOTIFY_TEAM');

-- CreateEnum
CREATE TYPE "NbaStatus" AS ENUM ('SUGGESTED', 'DRAFTED', 'EDITED', 'APPROVED', 'SENT', 'DISMISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CapabilityKind" AS ENUM ('NOTE_TAKER', 'CALLING', 'EMAIL', 'MEETING_SCHEDULER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MARKETING_COLLATERAL', 'SALES_COLLATERAL', 'BATTLECARD', 'EMAIL_ATTACHMENT');

-- CreateEnum
CREATE TYPE "DocumentPath" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'READY', 'SENT');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "mqlAt" TIMESTAMP(3),
ADD COLUMN     "promotedDealId" TEXT;

-- CreateTable
CREATE TABLE "HubSpotIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "portalId" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubSpotIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hubspotDealId" TEXT NOT NULL,
    "name" TEXT,
    "cachedStage" TEXT,
    "cachedOwner" TEXT,
    "cachedAmount" DOUBLE PRECISION,
    "cachedCurrency" TEXT,
    "stageSnapshotAt" TIMESTAMP(3),
    "originContactCampaignId" TEXT,
    "source" "DealSource" NOT NULL DEFAULT 'MANUAL',
    "autopilot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealContext" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sourceRefs" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "scope" "InsightScope" NOT NULL DEFAULT 'DEAL',
    "kind" "DealSignalKind" NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "summary" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signalReferenceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "raw" JSONB,
    "processedForNbaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "InsightScope" NOT NULL,
    "dealId" TEXT,
    "companyId" TEXT,
    "executiveSummary" JSONB,
    "stakeholderIntelligence" JSONB,
    "valueIntelligence" JSONB,
    "riskIntelligence" JSONB,
    "temporalIntelligence" JSONB,
    "competitiveIntelligence" JSONB,
    "expansionIntelligence" JSONB,
    "actionableRecommendations" JSONB,
    "systemMetadata" JSONB,
    "modelUsed" TEXT,
    "providerUsage" JSONB,
    "providerCost" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCapability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capability" "CapabilityKind" NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "detail" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NbaTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actionType" "NbaActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "collateralTemplateId" TEXT,
    "promptScaffold" TEXT,
    "guardrails" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NbaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NbaRecommendation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "scope" "InsightScope" NOT NULL DEFAULT 'DEAL',
    "actionType" "NbaActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signalReferenceId" TEXT,
    "payload" JSONB,
    "templateId" TEXT,
    "status" "NbaStatus" NOT NULL DEFAULT 'SUGGESTED',
    "juryResult" JSONB,
    "modelUsed" TEXT,
    "providerUsage" JSONB,
    "providerCost" JSONB,
    "executedAt" TIMESTAMP(3),
    "hubspotEngagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NbaRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "nbaRecommendationId" TEXT,
    "type" "DocumentType" NOT NULL,
    "path" "DocumentPath" NOT NULL,
    "contentJson" JSONB,
    "renderedHtml" TEXT,
    "pdfUrl" TEXT,
    "brand" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "modelUsed" TEXT,
    "providerUsage" JSONB,
    "providerCost" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubSpotIntegration_tenantId_key" ON "HubSpotIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_idx" ON "Deal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_tenantId_hubspotDealId_key" ON "Deal"("tenantId", "hubspotDealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealContext_dealId_key" ON "DealContext"("dealId");

-- CreateIndex
CREATE INDEX "DealContext_tenantId_idx" ON "DealContext"("tenantId");

-- CreateIndex
CREATE INDEX "DealSignal_tenantId_dealId_idx" ON "DealSignal"("tenantId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealSignal_tenantId_source_kind_externalId_key" ON "DealSignal"("tenantId", "source", "kind", "externalId");

-- CreateIndex
CREATE INDEX "DealInsight_tenantId_dealId_idx" ON "DealInsight"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "DealInsight_tenantId_companyId_idx" ON "DealInsight"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "TenantCapability_tenantId_idx" ON "TenantCapability"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCapability_tenantId_capability_key" ON "TenantCapability"("tenantId", "capability");

-- CreateIndex
CREATE INDEX "NbaTemplate_tenantId_idx" ON "NbaTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "NbaRecommendation_tenantId_dealId_idx" ON "NbaRecommendation"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "Document_tenantId_dealId_idx" ON "Document"("tenantId", "dealId");

-- AddForeignKey
ALTER TABLE "HubSpotIntegration" ADD CONSTRAINT "HubSpotIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContext" ADD CONSTRAINT "DealContext_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSignal" ADD CONSTRAINT "DealSignal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInsight" ADD CONSTRAINT "DealInsight_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbaRecommendation" ADD CONSTRAINT "NbaRecommendation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
