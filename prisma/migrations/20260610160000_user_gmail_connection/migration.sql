-- Per-user Gmail OAuth for NBA email send from AE Assist.
CREATE TABLE "UserGmailConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserGmailConnection_tenantId_userId_key" ON "UserGmailConnection"("tenantId", "userId");
CREATE INDEX "UserGmailConnection_tenantId_idx" ON "UserGmailConnection"("tenantId");
CREATE INDEX "UserGmailConnection_userId_idx" ON "UserGmailConnection"("userId");

ALTER TABLE "UserGmailConnection" ADD CONSTRAINT "UserGmailConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGmailConnection" ADD CONSTRAINT "UserGmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
