-- Track HubSpot deal created when a qualified campaign contact is pushed to CRM.
ALTER TABLE "CampaignContact" ADD COLUMN "hubspotDealId" TEXT;
ALTER TABLE "CampaignContact" ADD COLUMN "crmSyncedAt" TIMESTAMP(3);
