-- CreateEnum
CREATE TYPE "CollateralCategory" AS ENUM ('MARKETING', 'SALES');

-- AlterTable
ALTER TABLE "CollateralIndex" ADD COLUMN     "category" "CollateralCategory",
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CollateralIndex_tenantId_isTemplate_idx" ON "CollateralIndex"("tenantId", "isTemplate");

