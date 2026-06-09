-- CreateEnum
CREATE TYPE "DealStageBand" AS ENUM ('LEAD', 'DEAL_EARLY', 'DEAL_LATE');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "NbaStatus" AS ENUM ('SUGGESTED', 'DRAFTED', 'APPROVED', 'EXECUTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('OBJECTION', 'CONFUSION', 'EXPANSION', 'CHURN_RISK', 'DEAL_HEALTH', 'WHITESPACE', 'COMPETITIVE', 'INTEGRATION', 'REVOPS');

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('MARKETING_DOC', 'PITCH_DECK', 'BATTLECARD', 'ONE_PAGER', 'CASE_STUDY', 'EMAIL_TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "CollateralSrc" AS ENUM ('GENERATED', 'HEYPARROT', 'PILOT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('LEAD', 'DEAL_EARLY', 'DEAL_LATE', 'ANY');

-- CreateEnum
CREATE TYPE "AssistAction" AS ENUM ('INSIGHT_COMPUTED', 'NBA_DRAFTED', 'NBA_EXECUTED', 'EMAIL_DRAFTED', 'COLLATERAL_SENT', 'TASK_CREATED', 'NOTE_ADDED', 'DEAL_CREATED', 'MEETING_SCHEDULED', 'CHAT_QUERY');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "hubspotContactId" TEXT;

-- CreateTable
CREATE TABLE "MofuIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encryptedHubspotToken" TEXT NOT NULL,
    "hubspotPortalId" TEXT,
    "defaultOwnerId" TEXT,
    "insightModel" TEXT,
    "promptVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MofuIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "hubspotCompanyId" TEXT NOT NULL,
    "ownerId" TEXT,
    "lifecycleStage" TEXT,
    "payload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "hubspotDealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageLabel" TEXT,
    "stageBand" "DealStageBand",
    "amount" DOUBLE PRECISION,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "score" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "payload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealContact" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "score" INTEGER,
    "briefing" TEXT,
    "summary" TEXT,
    "payload" JSONB NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "tokensUsed" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "tokensUsed" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NbaRecommendation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT,
    "contactId" TEXT,
    "signalId" TEXT,
    "actionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "status" "NbaStatus" NOT NULL DEFAULT 'SUGGESTED',
    "draftPayload" JSONB,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NbaRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT,
    "accountId" TEXT,
    "type" "SignalType" NOT NULL,
    "tier" INTEGER,
    "headline" TEXT NOT NULL,
    "evidence" TEXT,
    "sourceUrl" TEXT,
    "suggestedAngle" TEXT,
    "slaHours" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralIndex" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CollateralType" NOT NULL,
    "source" "CollateralSrc" NOT NULL,
    "externalId" TEXT,
    "slug" TEXT,
    "url" TEXT,
    "funnelStage" "FunnelStage" NOT NULL DEFAULT 'ANY',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companyHsId" TEXT,
    "dealHsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollateralIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "hsObjectId" TEXT,
    "action" "AssistAction" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MofuIntegration_tenantId_key" ON "MofuIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");

-- CreateIndex
CREATE INDEX "Account_tenantId_ownerId_idx" ON "Account"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Account_companyId_idx" ON "Account"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_tenantId_hubspotCompanyId_key" ON "Account"("tenantId", "hubspotCompanyId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_idx" ON "Deal"("tenantId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_status_idx" ON "Deal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Deal_accountId_idx" ON "Deal"("accountId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_ownerId_idx" ON "Deal"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_tenantId_hubspotDealId_key" ON "Deal"("tenantId", "hubspotDealId");

-- CreateIndex
CREATE INDEX "DealContact_contactId_idx" ON "DealContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "DealContact_dealId_contactId_key" ON "DealContact"("dealId", "contactId");

-- CreateIndex
CREATE INDEX "DealInsight_dealId_idx" ON "DealInsight"("dealId");

-- CreateIndex
CREATE INDEX "DealInsight_tenantId_computedAt_idx" ON "DealInsight"("tenantId", "computedAt");

-- CreateIndex
CREATE INDEX "CompanyInsight_accountId_idx" ON "CompanyInsight"("accountId");

-- CreateIndex
CREATE INDEX "CompanyInsight_tenantId_computedAt_idx" ON "CompanyInsight"("tenantId", "computedAt");

-- CreateIndex
CREATE INDEX "NbaRecommendation_tenantId_idx" ON "NbaRecommendation"("tenantId");

-- CreateIndex
CREATE INDEX "NbaRecommendation_dealId_idx" ON "NbaRecommendation"("dealId");

-- CreateIndex
CREATE INDEX "NbaRecommendation_tenantId_status_idx" ON "NbaRecommendation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Signal_tenantId_idx" ON "Signal"("tenantId");

-- CreateIndex
CREATE INDEX "Signal_dealId_idx" ON "Signal"("dealId");

-- CreateIndex
CREATE INDEX "Signal_tenantId_type_idx" ON "Signal"("tenantId", "type");

-- CreateIndex
CREATE INDEX "CollateralIndex_tenantId_idx" ON "CollateralIndex"("tenantId");

-- CreateIndex
CREATE INDEX "CollateralIndex_tenantId_funnelStage_idx" ON "CollateralIndex"("tenantId", "funnelStage");

-- CreateIndex
CREATE INDEX "CollateralIndex_tenantId_companyHsId_idx" ON "CollateralIndex"("tenantId", "companyHsId");

-- CreateIndex
CREATE UNIQUE INDEX "CollateralIndex_tenantId_slug_key" ON "CollateralIndex"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "AssistActionLog_tenantId_createdAt_idx" ON "AssistActionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistActionLog_tenantId_hsObjectId_idx" ON "AssistActionLog"("tenantId", "hsObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_hubspotContactId_key" ON "Contact"("tenantId", "hubspotContactId");

-- AddForeignKey
ALTER TABLE "MofuIntegration" ADD CONSTRAINT "MofuIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInsight" ADD CONSTRAINT "DealInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInsight" ADD CONSTRAINT "DealInsight_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInsight" ADD CONSTRAINT "CompanyInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInsight" ADD CONSTRAINT "CompanyInsight_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbaRecommendation" ADD CONSTRAINT "NbaRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbaRecommendation" ADD CONSTRAINT "NbaRecommendation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbaRecommendation" ADD CONSTRAINT "NbaRecommendation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NbaRecommendation" ADD CONSTRAINT "NbaRecommendation_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralIndex" ADD CONSTRAINT "CollateralIndex_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistActionLog" ADD CONSTRAINT "AssistActionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

