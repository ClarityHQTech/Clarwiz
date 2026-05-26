-- CreateTable
CREATE TABLE "TenantIcpContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyDomain" TEXT,
    "relevantData" TEXT,
    "userQuery" TEXT,
    "accountData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStep" TEXT,
    "icpGapAnalysis" TEXT,
    "marketResearch" TEXT,
    "valueProposition" TEXT,
    "icpWorkbook" TEXT,
    "accountSignals" TEXT,
    "lastError" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIcpContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantIcpContext_userId_key" ON "TenantIcpContext"("userId");

-- AddForeignKey
ALTER TABLE "TenantIcpContext" ADD CONSTRAINT "TenantIcpContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
