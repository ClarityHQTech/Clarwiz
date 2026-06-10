/**
 * When HubSpot has meetings/calls but no usable transcript content, suggest
 * connecting a call/meeting recorder — a deterministic setup NBA (not LLM-generated).
 */
import { assessRecordingScopes } from "@/lib/assist/hubspotScopes.js";

export const SETUP_RECORDING_VERB = "Shared::Setup_Recording";
export const SETUP_RECORDING_TITLE = "Connect call/meeting recorder in HubSpot";

const SETUP_RATIONALE =
  "This deal has completed meetings or calls in HubSpot, but Clarwiz could not pull " +
  "recordings or transcripts. Connect Zoom, Google Meet, HubSpot Conversation Intelligence, " +
  "or a calling integration that syncs transcripts to HubSpot, then re-sync from AE Assist.";

const SCOPE_RATIONALE =
  "Reconnect HubSpot and grant the calling transcripts scope " +
  "(crm.extensions_calling_transcripts.read) so Clarwiz can fetch call transcripts after sync.";

/**
 * Create or refresh a setup NBA on deals that need recording integration.
 * Returns the number of NBAs created/updated.
 */
export async function ensureRecordingSetupNbas(prisma, tenantId, { scopes = [], syncSummary = null } = {}) {
  const scopeInfo = assessRecordingScopes(scopes);
  const dealsNeedingSetup = await findDealsNeedingRecordingSetup(prisma, tenantId, syncSummary);

  let upserted = 0;
  for (const dealId of dealsNeedingSetup) {
    const rationale = !scopeInfo.hasTranscriptsRead ? SCOPE_RATIONALE : SETUP_RATIONALE;

    const existing = await prisma.nbaRecommendation.findFirst({
      where: {
        tenantId,
        dealId,
        actionVerb: SETUP_RECORDING_VERB,
        status: { in: ["SUGGESTED", "DRAFTED", "APPROVED"] },
      },
    });

    if (existing) {
      await prisma.nbaRecommendation.update({
        where: { id: existing.id },
        data: { rationale, score: Math.max(existing.score ?? 0, 85) },
      });
    } else {
      await prisma.nbaRecommendation.create({
        data: {
          tenantId,
          dealId,
          title: SETUP_RECORDING_TITLE,
          actionType: "create_task",
          actionVerb: SETUP_RECORDING_VERB,
          score: 85,
          rationale,
          status: "SUGGESTED",
          payload: {
            setup_type: "hubspot_recording",
            missing_transcript_scope: !scopeInfo.hasTranscriptsRead,
            hubspot_integrations_url: "https://app.hubspot.com/integrations",
          },
        },
      });
    }
    upserted += 1;
  }

  // Dismiss stale setup NBAs when the deal now has transcript content.
  await dismissResolvedSetupNbas(prisma, tenantId);

  return upserted;
}

async function findDealsNeedingRecordingSetup(prisma, tenantId, syncSummary) {
  const dealIds = new Set();

  if (syncSummary?.summaries?.length) {
    for (const s of syncSummary.summaries) {
      if (!s.dealId) continue;
      const needs =
        (s.pastMeetingsWithoutTranscript ?? 0) > 0 ||
        (s.transcriptsUnavailable ?? 0) > 0 ||
        ((s.calls ?? 0) + (s.meetings ?? 0) > 0 && (s.transcriptsFetched ?? 0) === 0);
      if (needs) dealIds.add(s.dealId);
    }
  }

  if (dealIds.size === 0) {
    const rows = await prisma.dealRecording.findMany({
      where: { tenantId },
      select: {
        dealId: true,
        engagementType: true,
        transcriptAvailable: true,
        payload: true,
      },
    });

    const byDeal = new Map();
    for (const r of rows) {
      const list = byDeal.get(r.dealId) ?? [];
      list.push(r);
      byDeal.set(r.dealId, list);
    }

    for (const [dealId, recs] of byDeal) {
      const hasContent = recs.some((r) => r.transcriptAvailable);
      if (hasContent) continue;
      const hasPastMeeting = recs.some(
        (r) => r.engagementType === "meeting" && isPastMeetingPayload(r.payload)
      );
      const hasCall = recs.some((r) => r.engagementType === "call");
      if (hasPastMeeting || hasCall) dealIds.add(dealId);
    }
  }

  return [...dealIds];
}

function isPastMeetingPayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const end = p.hs_meeting_end_time;
  if (end) {
    const ms = Number(end);
    if (Number.isFinite(ms)) return ms < Date.now();
    const d = Date.parse(end);
    if (Number.isFinite(d)) return d < Date.now();
  }
  return String(p.hs_meeting_outcome ?? "").toUpperCase() === "COMPLETED";
}

async function dismissResolvedSetupNbas(prisma, tenantId) {
  const openSetup = await prisma.nbaRecommendation.findMany({
    where: {
      tenantId,
      actionVerb: SETUP_RECORDING_VERB,
      status: { in: ["SUGGESTED", "DRAFTED", "APPROVED"] },
    },
    select: { id: true, dealId: true },
  });

  for (const nba of openSetup) {
    const hasTranscript = await prisma.dealRecording.findFirst({
      where: { dealId: nba.dealId, tenantId, transcriptAvailable: true },
    });
    if (hasTranscript) {
      await prisma.nbaRecommendation.update({
        where: { id: nba.id },
        data: { status: "DISMISSED" },
      });
    }
  }
}
