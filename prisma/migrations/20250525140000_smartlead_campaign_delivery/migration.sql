-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "smartleadCampaignId" INTEGER;

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN "deliveryProvider" TEXT;
ALTER TABLE "CommunicationLog" ADD COLUMN "deliveryMeta" JSONB;
