-- CreateTable
CREATE TABLE "LinkedInIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkupAccountId" TEXT NOT NULL,
    "accountName" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "challengeType" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInIntegration_userId_key" ON "LinkedInIntegration"("userId");

-- CreateIndex
CREATE INDEX "LinkedInIntegration_linkupAccountId_idx" ON "LinkedInIntegration"("linkupAccountId");

-- AddForeignKey
ALTER TABLE "LinkedInIntegration" ADD CONSTRAINT "LinkedInIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
