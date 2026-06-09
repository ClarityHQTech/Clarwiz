-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "enabledChannels" TEXT[] NOT NULL DEFAULT ARRAY['email', 'linkedin', 'whatsapp']::TEXT[];
