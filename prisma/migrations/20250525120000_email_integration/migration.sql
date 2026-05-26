-- CreateTable
CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'smartlead_inbox',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fromEmail" TEXT,
    "fromName" TEXT,
    "sendingDomain" TEXT,
    "providerType" TEXT,
    "encryptedSmartleadAccountId" TEXT,
    "customTrackingDomain" TEXT,
    "isSmtpSuccess" BOOLEAN,
    "isImapSuccess" BOOLEAN,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warmupStatus" TEXT,
    "warmupReputation" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIntegration_userId_key" ON "EmailIntegration"("userId");

-- AddForeignKey
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
