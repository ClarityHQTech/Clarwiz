-- AlterTable
ALTER TABLE "DealSignal" ADD COLUMN     "contactId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sourceTemplateId" TEXT,
ALTER COLUMN "path" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CollateralTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "schema" JSONB,
    "category" TEXT NOT NULL DEFAULT 'marketing',
    "scope" TEXT NOT NULL DEFAULT 'tenant',
    "source" TEXT NOT NULL DEFAULT 'uploaded',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollateralTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollateralTemplate_tenantId_idx" ON "CollateralTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "DealSignal_tenantId_contactId_idx" ON "DealSignal"("tenantId", "contactId");
