-- AlterTable
ALTER TABLE "AssistActionLog" ADD COLUMN "modelUsed" TEXT,
ADD COLUMN "providerUsage" JSONB,
ADD COLUMN "providerCost" JSONB;
