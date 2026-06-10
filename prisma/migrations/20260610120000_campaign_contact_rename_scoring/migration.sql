-- Rename enum ContactCampaignStatus -> CampaignContactStatus
ALTER TYPE "ContactCampaignStatus" RENAME TO "CampaignContactStatus";

-- Rename table ContactCampaign -> CampaignContact
ALTER TABLE "ContactCampaign" RENAME TO "CampaignContact";

-- Rename ContactCampaign indexes/constraints to CampaignContact_*
ALTER TABLE "CampaignContact" RENAME CONSTRAINT "ContactCampaign_pkey" TO "CampaignContact_pkey";
ALTER TABLE "CampaignContact" RENAME CONSTRAINT "ContactCampaign_contactId_fkey" TO "CampaignContact_contactId_fkey";
ALTER TABLE "CampaignContact" RENAME CONSTRAINT "ContactCampaign_campaignId_fkey" TO "CampaignContact_campaignId_fkey";
ALTER INDEX "ContactCampaign_contactId_campaignId_key" RENAME TO "CampaignContact_contactId_campaignId_key";
ALTER INDEX "ContactCampaign_campaignId_idx" RENAME TO "CampaignContact_campaignId_idx";
ALTER INDEX "ContactCampaign_campaignId_nextScheduledOutreachAt_idx" RENAME TO "CampaignContact_campaignId_nextScheduledOutreachAt_idx";
ALTER INDEX "ContactCampaign_campaignId_status_idx" RENAME TO "CampaignContact_campaignId_status_idx";

-- Rename CommunicationLog.contactCampaignId -> campaignContactId (+ index/constraint)
ALTER TABLE "CommunicationLog" RENAME COLUMN "contactCampaignId" TO "campaignContactId";
ALTER TABLE "CommunicationLog" RENAME CONSTRAINT "CommunicationLog_contactCampaignId_fkey" TO "CommunicationLog_campaignContactId_fkey";
ALTER INDEX "CommunicationLog_contactCampaignId_idx" RENAME TO "CommunicationLog_campaignContactId_idx";
ALTER INDEX "CommunicationLog_campaignId_contactCampaignId_idx" RENAME TO "CommunicationLog_campaignId_campaignContactId_idx";

-- Scoring columns on CampaignContact
ALTER TABLE "CampaignContact" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignContact" ADD COLUMN "scoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "CampaignContact" ADD COLUMN "scoreBreakdown" JSONB;

-- Per-campaign qualification threshold
ALTER TABLE "Campaign" ADD COLUMN "qualificationThreshold" INTEGER NOT NULL DEFAULT 90;
