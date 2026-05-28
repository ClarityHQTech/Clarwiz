-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN');
CREATE TYPE "TenantRole" AS ENUM ('TENANT_ADMIN', 'ASSIGNED_USER');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable TenantMembership
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable TenantInvitation
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- Add platformRole to User
ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole";

-- Migrate admin users to SUPER_ADMIN
UPDATE "User" SET "platformRole" = 'SUPER_ADMIN' WHERE "role" = 'admin';

-- Create tenant per user and membership
INSERT INTO "Tenant" ("id", "name", "payment", "createdAt", "updatedAt")
SELECT
    'tenant_' || u."id",
    COALESCE(NULLIF(TRIM(u."name"), ''), split_part(u."email", '@', 1)),
    u."payment",
    u."createdAt",
    u."updatedAt"
FROM "User" u;

INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "role", "permissions", "createdAt", "updatedAt")
SELECT
    'mem_' || u."id",
    'tenant_' || u."id",
    u."id",
    'TENANT_ADMIN'::"TenantRole",
    ARRAY[]::TEXT[],
    u."createdAt",
    u."updatedAt"
FROM "User" u;

-- Add tenantId columns (nullable during backfill)
ALTER TABLE "TenantIcpContext" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "LinkedInIntegration" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "EmailIntegration" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CalendlyIntegration" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WhatsAppIntegration" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ProspectSignal" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CommunicationLog" ADD COLUMN "tenantId" TEXT;

-- Backfill tenantId from userId
UPDATE "TenantIcpContext" SET "tenantId" = 'tenant_' || "userId";
UPDATE "LinkedInIntegration" SET "tenantId" = 'tenant_' || "userId";
UPDATE "EmailIntegration" SET "tenantId" = 'tenant_' || "userId";
UPDATE "CalendlyIntegration" SET "tenantId" = 'tenant_' || "userId";
UPDATE "WhatsAppIntegration" SET "tenantId" = 'tenant_' || "userId";
UPDATE "Campaign" SET "tenantId" = 'tenant_' || "userId";
UPDATE "ProspectSignal" SET "tenantId" = 'tenant_' || "userId";
UPDATE "CommunicationLog" SET "tenantId" = 'tenant_' || "userId";

-- Drop old FKs and userId columns
ALTER TABLE "TenantIcpContext" DROP CONSTRAINT "TenantIcpContext_userId_fkey";
ALTER TABLE "TenantIcpContext" DROP COLUMN "userId";
ALTER TABLE "LinkedInIntegration" DROP CONSTRAINT "LinkedInIntegration_userId_fkey";
ALTER TABLE "LinkedInIntegration" DROP COLUMN "userId";
ALTER TABLE "EmailIntegration" DROP CONSTRAINT "EmailIntegration_userId_fkey";
ALTER TABLE "EmailIntegration" DROP COLUMN "userId";
ALTER TABLE "CalendlyIntegration" DROP CONSTRAINT "CalendlyIntegration_userId_fkey";
ALTER TABLE "CalendlyIntegration" DROP COLUMN "userId";
ALTER TABLE "WhatsAppIntegration" DROP CONSTRAINT "WhatsAppIntegration_userId_fkey";
ALTER TABLE "WhatsAppIntegration" DROP COLUMN "userId";
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_userId_fkey";
ALTER TABLE "Campaign" DROP COLUMN "userId";
ALTER TABLE "ProspectSignal" DROP CONSTRAINT "ProspectSignal_userId_fkey";
ALTER TABLE "ProspectSignal" DROP COLUMN "userId";
ALTER TABLE "CommunicationLog" DROP CONSTRAINT "CommunicationLog_userId_fkey";
ALTER TABLE "CommunicationLog" DROP COLUMN "userId";

-- Make tenantId required and add constraints
ALTER TABLE "TenantIcpContext" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LinkedInIntegration" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "EmailIntegration" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CalendlyIntegration" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "WhatsAppIntegration" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ProspectSignal" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CommunicationLog" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX "TenantIcpContext_tenantId_key" ON "TenantIcpContext"("tenantId");
CREATE UNIQUE INDEX "LinkedInIntegration_tenantId_key" ON "LinkedInIntegration"("tenantId");
CREATE UNIQUE INDEX "EmailIntegration_tenantId_key" ON "EmailIntegration"("tenantId");
CREATE UNIQUE INDEX "CalendlyIntegration_tenantId_key" ON "CalendlyIntegration"("tenantId");
CREATE UNIQUE INDEX "WhatsAppIntegration_tenantId_key" ON "WhatsAppIntegration"("tenantId");

ALTER TABLE "TenantIcpContext" ADD CONSTRAINT "TenantIcpContext_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedInIntegration" ADD CONSTRAINT "LinkedInIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendlyIntegration" ADD CONSTRAINT "CalendlyIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppIntegration" ADD CONSTRAINT "WhatsAppIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectSignal" ADD CONSTRAINT "ProspectSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old indexes and create new ones
DROP INDEX IF EXISTS "Campaign_userId_idx";
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");
DROP INDEX IF EXISTS "ProspectSignal_userId_idx";
CREATE INDEX "ProspectSignal_tenantId_idx" ON "ProspectSignal"("tenantId");
DROP INDEX IF EXISTS "CommunicationLog_userId_idx";
DROP INDEX IF EXISTS "CommunicationLog_userId_sentAt_idx";
CREATE INDEX "CommunicationLog_tenantId_idx" ON "CommunicationLog"("tenantId");
CREATE INDEX "CommunicationLog_tenantId_sentAt_idx" ON "CommunicationLog"("tenantId", "sentAt");

-- TenantMembership FKs and indexes
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TenantInvitation FKs and indexes
CREATE UNIQUE INDEX "TenantInvitation_token_key" ON "TenantInvitation"("token");
CREATE INDEX "TenantInvitation_tenantId_email_idx" ON "TenantInvitation"("tenantId", "email");
CREATE INDEX "TenantInvitation_token_idx" ON "TenantInvitation"("token");
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove deprecated User columns
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" DROP COLUMN "payment";
