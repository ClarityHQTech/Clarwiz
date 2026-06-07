-- DropIndex
DROP INDEX "Signal_tenantId_type_idx";

-- AlterTable
ALTER TABLE "NbaRecommendation" ADD COLUMN     "actionVerb" TEXT,
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "category" TEXT,
ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "score" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "SignalType";

-- CreateIndex
CREATE INDEX "Signal_tenantId_category_idx" ON "Signal"("tenantId", "category");

