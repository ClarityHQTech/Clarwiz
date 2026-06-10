-- Store HubSpot call/meeting recordings & transcripts synced during MOFU CRM sync.
CREATE TABLE "DealRecording" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "hubspotEngagementId" TEXT NOT NULL,
    "engagementType" TEXT NOT NULL,
    "title" TEXT,
    "recordingUrl" TEXT,
    "hubspotTranscriptId" TEXT,
    "transcriptText" TEXT,
    "transcriptSource" TEXT,
    "transcriptAvailable" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRecording_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealRecording_dealId_hubspotEngagementId_engagementType_key" ON "DealRecording"("dealId", "hubspotEngagementId", "engagementType");
CREATE INDEX "DealRecording_tenantId_idx" ON "DealRecording"("tenantId");
CREATE INDEX "DealRecording_dealId_idx" ON "DealRecording"("dealId");

ALTER TABLE "DealRecording" ADD CONSTRAINT "DealRecording_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRecording" ADD CONSTRAINT "DealRecording_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
