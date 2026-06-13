-- CreateTable
CREATE TABLE "DealGtmTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "pathIndex" INTEGER NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "hubspotTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealGtmTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealGtmTask_tenantId_dealId_idx" ON "DealGtmTask"("tenantId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealGtmTask_dealId_stepKey_key" ON "DealGtmTask"("dealId", "stepKey");

-- AddForeignKey
ALTER TABLE "DealGtmTask" ADD CONSTRAINT "DealGtmTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealGtmTask" ADD CONSTRAINT "DealGtmTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
