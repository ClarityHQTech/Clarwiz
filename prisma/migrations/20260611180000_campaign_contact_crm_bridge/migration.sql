-- Link MOFU CRM graph (Deal, Account, DealContact) back to TOFU CampaignContact
-- so AE Assist can hydrate outreach context (comm logs, score, persona) after HubSpot sync.

ALTER TABLE "Deal" ADD COLUMN "campaignContactId" TEXT;
ALTER TABLE "Account" ADD COLUMN "campaignContactId" TEXT;
ALTER TABLE "DealContact" ADD COLUMN "campaignContactId" TEXT;

CREATE INDEX "Deal_campaignContactId_idx" ON "Deal"("campaignContactId");
CREATE INDEX "Account_campaignContactId_idx" ON "Account"("campaignContactId");
CREATE INDEX "DealContact_campaignContactId_idx" ON "DealContact"("campaignContactId");
CREATE INDEX "CampaignContact_hubspotDealId_idx" ON "CampaignContact"("hubspotDealId");

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_campaignContactId_fkey" FOREIGN KEY ("campaignContactId") REFERENCES "CampaignContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_campaignContactId_fkey" FOREIGN KEY ("campaignContactId") REFERENCES "CampaignContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_campaignContactId_fkey" FOREIGN KEY ("campaignContactId") REFERENCES "CampaignContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
