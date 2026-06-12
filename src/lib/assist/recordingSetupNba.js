/**
 * When HubSpot has a completed meeting with no meeting notes / recorder transcript,
 * suggest verifying a meeting recorder integration — a deterministic setup NBA
 * (not LLM-generated).
 */
export const SETUP_RECORDING_VERB = "Shared::Setup_Recording";
export const SETUP_RECORDING_TITLE = "Verify meeting recorder is connected in HubSpot";

export const SETUP_RATIONALE =
  "At least one completed meeting was synced from HubSpot for this deal, but it has no " +
  "meeting notes or recorder transcript. That usually means no meeting recorder " +
  "(e.g. Fireflies, Gong, Zoom, HubSpot Conversation Intelligence) is connected or " +
  "syncing notes into HubSpot. Check your recorder integration in HubSpot, then run " +
  "AE Assist sync again.";

/** True when a DealRecording row is a HubSpot meeting that already occurred. */
export function isPastHubspotMeeting(recording) {
  if (!recording || recording.engagementType !== "meeting") return false;

  const payload =
    recording.payload && typeof recording.payload === "object" ? recording.payload : {};
  const end = payload.hs_meeting_end_time;
  if (end != null) {
    const ms = Number(end);
    if (Number.isFinite(ms)) return ms < Date.now();
    const parsed = Date.parse(end);
    if (Number.isFinite(parsed)) return parsed < Date.now();
  }

  if (String(payload.hs_meeting_outcome ?? "").toUpperCase() === "COMPLETED") {
    return true;
  }

  if (recording.occurredAt instanceof Date) {
    return recording.occurredAt.getTime() < Date.now();
  }

  return false;
}

/**
 * A past HubSpot meeting with no notes/transcript → recorder likely not connected.
 * Pure helper for tests and deal-level checks.
 */
export function meetingLacksRecorderNotes(recording) {
  if (!isPastHubspotMeeting(recording)) return false;
  const text = typeof recording.transcriptText === "string" ? recording.transcriptText.trim() : "";
  return !recording.transcriptAvailable && !text;
}

/** True when any synced past meeting on the deal has no recorder notes. */
export function dealNeedsMeetingRecorderSetup(recordings = []) {
  return recordings.some(meetingLacksRecorderNotes);
}

async function findDealIdsNeedingMeetingRecorderSetup(prisma, tenantId, { dealId = null } = {}) {
  const where = { tenantId, engagementType: "meeting" };
  if (dealId) where.dealId = dealId;

  const rows = await prisma.dealRecording.findMany({
    where,
    select: {
      dealId: true,
      engagementType: true,
      transcriptAvailable: true,
      transcriptText: true,
      payload: true,
      occurredAt: true,
    },
  });

  const byDeal = new Map();
  for (const row of rows) {
    const list = byDeal.get(row.dealId) ?? [];
    list.push(row);
    byDeal.set(row.dealId, list);
  }

  const dealIds = [];
  for (const [id, recs] of byDeal) {
    if (dealNeedsMeetingRecorderSetup(recs)) dealIds.push(id);
  }
  return dealIds;
}

async function upsertSetupNba(prisma, tenantId, dealId) {
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
      data: { rationale: SETUP_RATIONALE, score: Math.max(existing.score ?? 0, 85) },
    });
    return true;
  }

  await prisma.nbaRecommendation.create({
    data: {
      tenantId,
      dealId,
      title: SETUP_RECORDING_TITLE,
      actionType: "create_task",
      actionVerb: SETUP_RECORDING_VERB,
      score: 85,
      rationale: SETUP_RATIONALE,
      status: "SUGGESTED",
      payload: {
        setup_type: "hubspot_meeting_recorder",
        hubspot_integrations_url: "https://app.hubspot.com/integrations",
      },
    },
  });
  return true;
}

async function dismissSetupNbaIfResolved(prisma, tenantId, dealId) {
  const openSetup = await prisma.nbaRecommendation.findFirst({
    where: {
      tenantId,
      dealId,
      actionVerb: SETUP_RECORDING_VERB,
      status: { in: ["SUGGESTED", "DRAFTED", "APPROVED"] },
    },
    select: { id: true },
  });
  if (!openSetup) return;

  const recordings = await prisma.dealRecording.findMany({
    where: { tenantId, dealId, engagementType: "meeting" },
    select: {
      engagementType: true,
      transcriptAvailable: true,
      transcriptText: true,
      payload: true,
      occurredAt: true,
    },
  });

  if (!dealNeedsMeetingRecorderSetup(recordings)) {
    await prisma.nbaRecommendation.update({
      where: { id: openSetup.id },
      data: { status: "DISMISSED" },
    });
  }
}

/**
 * Create or refresh the meeting-recorder setup NBA for one deal.
 * Returns true when an NBA was created or updated.
 */
export async function ensureRecordingSetupNbaForDeal(prisma, tenantId, dealId) {
  const dealIds = await findDealIdsNeedingMeetingRecorderSetup(prisma, tenantId, { dealId });
  if (!dealIds.length) {
    await dismissSetupNbaIfResolved(prisma, tenantId, dealId);
    return false;
  }
  return upsertSetupNba(prisma, tenantId, dealId);
}

/**
 * Create or refresh meeting-recorder setup NBAs across the tenant (or one deal).
 * Returns the number of NBAs created or updated.
 */
export async function ensureRecordingSetupNbas(prisma, tenantId, { dealId = null } = {}) {
  const dealIds = await findDealIdsNeedingMeetingRecorderSetup(prisma, tenantId, { dealId });

  let upserted = 0;
  for (const id of dealIds) {
    await upsertSetupNba(prisma, tenantId, id);
    upserted += 1;
  }

  if (dealId) {
    if (!dealIds.includes(dealId)) {
      await dismissSetupNbaIfResolved(prisma, tenantId, dealId);
    }
  } else {
    const openSetup = await prisma.nbaRecommendation.findMany({
      where: {
        tenantId,
        actionVerb: SETUP_RECORDING_VERB,
        status: { in: ["SUGGESTED", "DRAFTED", "APPROVED"] },
      },
      select: { id: true, dealId: true },
    });

    for (const nba of openSetup) {
      if (dealIds.includes(nba.dealId)) continue;
      await dismissSetupNbaIfResolved(prisma, tenantId, nba.dealId);
    }
  }

  return upserted;
}
