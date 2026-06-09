-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Contact_tenantId_ownerId_idx" ON "Contact"("tenantId", "ownerId");

