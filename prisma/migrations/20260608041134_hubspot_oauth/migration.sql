-- AlterTable
ALTER TABLE "MofuIntegration" ADD COLUMN     "connectionMode" TEXT NOT NULL DEFAULT 'pat',
ADD COLUMN     "encryptedHubspotAccessToken" TEXT,
ADD COLUMN     "encryptedHubspotRefreshToken" TEXT,
ADD COLUMN     "hubspotScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hubspotTokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "encryptedHubspotToken" DROP NOT NULL;

