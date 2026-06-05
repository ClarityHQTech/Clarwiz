-- Contact / Company / BusinessUser restructure (all tables stay in public schema)

CREATE TYPE "ContactPersona" AS ENUM (
  'DECISION_MAKER',
  'INFLUENCER',
  'CHAMPION',
  'GATEKEEPER',
  'ECONOMIC_BUYER',
  'TECHNICAL_BUYER',
  'END_USER',
  'OTHER'
);

CREATE TYPE "ContactCampaignStatus" AS ENUM (
  'PENDING',
  'IN_OUTREACH',
  'REPLIED',
  'QUALIFIED',
  'NOT_QUALIFIED',
  'DISQUALIFIED',
  'PAUSED'
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "industry" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

CREATE TABLE "BusinessUser" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "jobTitle" TEXT,
  "department" TEXT,
  "seniority" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "linkedinUrl" TEXT,
  "twitterId" TEXT,
  "location" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessUser_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessUser_email_idx" ON "BusinessUser"("email");
CREATE INDEX "BusinessUser_linkedinUrl_idx" ON "BusinessUser"("linkedinUrl");
CREATE INDEX "BusinessUser_companyId_idx" ON "BusinessUser"("companyId");

ALTER TABLE "BusinessUser"
  ADD CONSTRAINT "BusinessUser_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BusinessUserSignal" (
  "id" TEXT NOT NULL,
  "businessUserId" TEXT NOT NULL,
  "tenantId" TEXT,
  "campaignId" TEXT,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessUserSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessUserSignal_businessUserId_idx" ON "BusinessUserSignal"("businessUserId");
CREATE INDEX "BusinessUserSignal_tenantId_idx" ON "BusinessUserSignal"("tenantId");
CREATE INDEX "BusinessUserSignal_campaignId_idx" ON "BusinessUserSignal"("campaignId");
CREATE INDEX "BusinessUserSignal_businessUserId_campaignId_idx" ON "BusinessUserSignal"("businessUserId", "campaignId");

ALTER TABLE "BusinessUserSignal"
  ADD CONSTRAINT "BusinessUserSignal_businessUserId_fkey"
  FOREIGN KEY ("businessUserId") REFERENCES "BusinessUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Company" ("id", "name", "updatedAt")
SELECT
  'co_' || substr(md5(lower(trim(p."company"))), 1, 24),
  trim(p."company"),
  CURRENT_TIMESTAMP
FROM "Prospect" p
WHERE p."company" IS NOT NULL AND trim(p."company") <> ''
GROUP BY lower(trim(p."company")), trim(p."company")
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "BusinessUser" (
  "id", "companyId", "name", "firstName", "jobTitle", "email", "phone", "whatsapp", "linkedinUrl", "updatedAt"
)
SELECT
  'bu_' || p."id",
  c."id",
  p."name",
  p."firstName",
  p."jobTitle",
  p."email",
  p."phone",
  p."whatsapp",
  p."linkedinUrl",
  CURRENT_TIMESTAMP
FROM "Prospect" p
LEFT JOIN "Company" c ON c."name" = trim(p."company")
WHERE trim(p."company") IS NOT NULL AND trim(p."company") <> ''
UNION ALL
SELECT
  'bu_' || p."id",
  NULL,
  p."name",
  p."firstName",
  p."jobTitle",
  p."email",
  p."phone",
  p."whatsapp",
  p."linkedinUrl",
  CURRENT_TIMESTAMP
FROM "Prospect" p
WHERE p."company" IS NULL OR trim(p."company") = '';

CREATE TABLE "Contact" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessUserId" TEXT NOT NULL,
  "persona" "ContactPersona" NOT NULL DEFAULT 'OTHER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contact_tenantId_businessUserId_key" ON "Contact"("tenantId", "businessUserId");
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");
CREATE INDEX "Contact_businessUserId_idx" ON "Contact"("businessUserId");

ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_businessUserId_fkey"
  FOREIGN KEY ("businessUserId") REFERENCES "BusinessUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Contact" ("id", "tenantId", "businessUserId", "persona", "updatedAt")
SELECT DISTINCT ON (cam."tenantId", bu."id")
  'ct_' || substr(md5(cam."tenantId" || bu."id"), 1, 24),
  cam."tenantId",
  bu."id",
  'OTHER'::"ContactPersona",
  CURRENT_TIMESTAMP
FROM "Prospect" p
JOIN "Campaign" cam ON cam."id" = p."campaignId"
JOIN "BusinessUser" bu ON bu."id" = 'bu_' || p."id"
ORDER BY cam."tenantId", bu."id", p."createdAt" ASC;

CREATE TABLE "ContactCampaign" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "status" "ContactCampaignStatus" NOT NULL DEFAULT 'PENDING',
  "qualifiedAt" TIMESTAMP(3),
  "qualifiedReason" TEXT,
  "outreachDeliveryTime" TEXT,
  "nextScheduledOutreachAt" TIMESTAMP(3),
  "lastOutreachDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactCampaign_contactId_campaignId_key" ON "ContactCampaign"("contactId", "campaignId");
CREATE INDEX "ContactCampaign_campaignId_idx" ON "ContactCampaign"("campaignId");
CREATE INDEX "ContactCampaign_campaignId_nextScheduledOutreachAt_idx" ON "ContactCampaign"("campaignId", "nextScheduledOutreachAt");
CREATE INDEX "ContactCampaign_campaignId_status_idx" ON "ContactCampaign"("campaignId", "status");

ALTER TABLE "ContactCampaign"
  ADD CONSTRAINT "ContactCampaign_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactCampaign"
  ADD CONSTRAINT "ContactCampaign_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ContactCampaign" (
  "id", "contactId", "campaignId", "status", "qualifiedAt", "qualifiedReason",
  "outreachDeliveryTime", "nextScheduledOutreachAt", "lastOutreachDate", "createdAt", "updatedAt"
)
SELECT
  p."id",
  ct."id",
  p."campaignId",
  CASE WHEN p."qualifiedAt" IS NOT NULL THEN 'QUALIFIED'::"ContactCampaignStatus" ELSE 'PENDING'::"ContactCampaignStatus" END,
  p."qualifiedAt",
  p."qualifiedReason",
  p."outreachDeliveryTime",
  p."nextScheduledOutreachAt",
  p."lastOutreachDate",
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "Prospect" p
JOIN "Campaign" cam ON cam."id" = p."campaignId"
JOIN "BusinessUser" bu ON bu."id" = 'bu_' || p."id"
JOIN "Contact" ct ON ct."tenantId" = cam."tenantId" AND ct."businessUserId" = bu."id";

ALTER TABLE "CommunicationLog" ADD COLUMN "contactCampaignId" TEXT;

UPDATE "CommunicationLog" cl
SET "contactCampaignId" = cl."prospectId";

ALTER TABLE "CommunicationLog" ALTER COLUMN "contactCampaignId" SET NOT NULL;

ALTER TABLE "CommunicationLog" DROP CONSTRAINT IF EXISTS "CommunicationLog_prospectId_fkey";
DROP INDEX IF EXISTS "CommunicationLog_prospectId_idx";
DROP INDEX IF EXISTS "CommunicationLog_campaignId_prospectId_idx";
ALTER TABLE "CommunicationLog" DROP COLUMN "prospectId";

CREATE INDEX "CommunicationLog_contactCampaignId_idx" ON "CommunicationLog"("contactCampaignId");
CREATE INDEX "CommunicationLog_campaignId_contactCampaignId_idx" ON "CommunicationLog"("campaignId", "contactCampaignId");

ALTER TABLE "CommunicationLog"
  ADD CONSTRAINT "CommunicationLog_contactCampaignId_fkey"
  FOREIGN KEY ("contactCampaignId") REFERENCES "ContactCampaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BusinessUserSignal" (
  "id", "businessUserId", "tenantId", "campaignId", "type", "source", "content", "createdAt"
)
SELECT
  ps."id",
  bu."id",
  ps."tenantId",
  ps."campaignId",
  ps."type",
  ps."source",
  ps."content",
  ps."createdAt"
FROM "ProspectSignal" ps
JOIN "BusinessUser" bu ON bu."id" = 'bu_' || ps."prospectId";

DROP TABLE "ProspectSignal";
DROP TABLE "Prospect";
