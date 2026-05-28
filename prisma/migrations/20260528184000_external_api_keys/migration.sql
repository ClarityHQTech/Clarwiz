-- CreateTable
CREATE TABLE "ExternalApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalApiKey_keyHash_key" ON "ExternalApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ExternalApiKey_tenantId_idx" ON "ExternalApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalApiKey_tenantId_revokedAt_idx" ON "ExternalApiKey"("tenantId", "revokedAt");

-- CreateIndex
CREATE INDEX "ExternalApiKey_tenantId_expiresAt_idx" ON "ExternalApiKey"("tenantId", "expiresAt");

-- AddForeignKey
ALTER TABLE "ExternalApiKey" ADD CONSTRAINT "ExternalApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
