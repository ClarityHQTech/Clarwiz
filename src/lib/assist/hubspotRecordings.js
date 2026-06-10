/**
 * Sync call/meeting recordings & transcripts from HubSpot into DealRecording rows.
 *
 * Scope notes (see hubspotRead.js):
 * - Full transcript text via the public API requires
 *   `crm.extensions_calling_transcripts.read` and works reliably for transcripts
 *   pushed by third-party calling integrations / the Recordings API.
 * - Native HubSpot CI or Google Meet / Zoom synced transcripts visible in the
 *   HubSpot UI often return 404 on the transcript endpoint — we store metadata +
 *   meeting notes as a fallback and flag transcriptAvailable=false.
 * - Legacy `hs_call_recording_url` may still exist on older portals but is deprecated.
 */
import { buildDealAssociationsUrl, stripHtml } from "@/lib/assist/hubspotRead.js";
import { hasHubspotScope, HUBSPOT_SCOPES } from "@/lib/assist/hubspotScopes.js";

const HUBSPOT_BASE = "https://api.hubapi.com";
const TRANSCRIPTS_API = "/crm/extensions/calling/2026-03/transcripts";

const CALL_PROPS = [
  "hs_call_title",
  "hs_call_body",
  "hs_timestamp",
  "hs_call_duration",
  "hs_call_recording_url",
  "hs_call_transcription_id",
  "hs_call_has_transcript",
  "hs_call_status",
];

const MEETING_PROPS = [
  "hs_meeting_title",
  "hs_meeting_body",
  "hs_internal_meeting_notes",
  "hs_meeting_outcome",
  "hs_timestamp",
  "hs_meeting_start_time",
  "hs_meeting_end_time",
];

function associationIds(json) {
  const results = json?.results ?? [];
  return results
    .map((r) => r?.toObjectId ?? r?.id ?? r?.to?.id)
    .filter((id) => id != null)
    .map(String);
}

function toMillis(ts) {
  if (ts == null) return null;
  if (typeof ts === "number") return ts;
  const n = Number(ts);
  if (Number.isFinite(n) && String(ts).trim() !== "") return n;
  const d = Date.parse(ts);
  return Number.isFinite(d) ? d : null;
}

function toDate(ts) {
  const ms = toMillis(ts);
  return ms ? new Date(ms) : null;
}

async function hsGet(token, path, fetchImpl) {
  const res = await fetchImpl(`${HUBSPOT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function hsBatchRead(token, objectType, ids, properties, fetchImpl) {
  if (!ids.length) return { ok: true, json: { results: [] } };
  const res = await fetchImpl(`${HUBSPOT_BASE}/crm/v3/objects/${objectType}/batch/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties, inputs: ids.map((id) => ({ id })) }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/** Flatten HubSpot transcript utterances into plain dialogue text. */
export function utterancesToText(utterances) {
  if (!Array.isArray(utterances) || !utterances.length) return "";
  return utterances
    .map((u) => {
      const speaker = u?.speaker?.name || u?.speaker?.email || "Speaker";
      const text = typeof u?.text === "string" ? u.text.trim() : "";
      return text ? `${speaker}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Fetch a call transcript from the HubSpot extensions API. Never throws.
 * Returns { ok, text, source, status, reason }.
 */
export async function fetchCallTranscript(token, transcriptId, { fetchImpl = fetch } = {}) {
  if (!token || !transcriptId) {
    return { ok: false, reason: "missing_input" };
  }
  try {
    const res = await hsGet(token, `${TRANSCRIPTS_API}/${encodeURIComponent(transcriptId)}`, fetchImpl);
    if (!res.ok) {
      if (res.status === 403) return { ok: false, reason: "missing_scope", status: 403 };
      if (res.status === 404) return { ok: false, reason: "not_api_accessible", status: 404 };
      return { ok: false, reason: "hubspot_error", status: res.status };
    }
    const text = utterancesToText(res.json?.transcriptUtterances);
    return {
      ok: Boolean(text),
      text,
      source: res.json?.transcriptSource ?? null,
      transcriptId: res.json?.id ?? transcriptId,
    };
  } catch (err) {
    return { ok: false, reason: "network_error", message: err.message };
  }
}

function meetingNotesText(props) {
  return [stripHtml(props.hs_meeting_body), stripHtml(props.hs_internal_meeting_notes)]
    .filter(Boolean)
    .join("\n\n");
}

function isPastMeeting(props) {
  const end = toMillis(props.hs_meeting_end_time);
  if (end) return end < Date.now();
  const outcome = String(props.hs_meeting_outcome ?? "").toUpperCase();
  return outcome === "COMPLETED";
}

async function loadAssociated(token, hubspotDealId, objectType, props, fetchImpl) {
  const assoc = await hsGet(
    token,
    buildDealAssociationsUrl(hubspotDealId, objectType),
    fetchImpl
  );
  if (!assoc.ok) return [];
  const ids = associationIds(assoc.json);
  if (!ids.length) return [];
  const batch = await hsBatchRead(token, objectType, ids, props, fetchImpl);
  if (!batch.ok) return [];
  return (batch.json?.results ?? []).map((r) => ({
    id: String(r.id),
    properties: r.properties ?? {},
  }));
}

/**
 * Sync recordings/transcripts for one deal. Returns a summary (never throws).
 */
export async function syncDealRecordings(
  prisma,
  tenantId,
  dealId,
  { token, scopes = [], fetchImpl = fetch } = {}
) {
  const empty = {
    dealId,
    calls: 0,
    meetings: 0,
    stored: 0,
    transcriptsFetched: 0,
    transcriptsUnavailable: 0,
    pastMeetingsWithoutTranscript: 0,
  };

  if (!token) return { ...empty, skipped: true, reason: "no_token" };

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    select: { id: true, hubspotDealId: true },
  });
  if (!deal?.hubspotDealId) return { ...empty, skipped: true, reason: "no_hubspot_deal" };

  const canReadTranscripts = hasHubspotScope(scopes, HUBSPOT_SCOPES.TRANSCRIPTS_READ);
  let stored = 0;
  let transcriptsFetched = 0;
  let transcriptsUnavailable = 0;
  let pastMeetingsWithoutTranscript = 0;

  const [calls, meetings] = await Promise.all([
    loadAssociated(token, deal.hubspotDealId, "calls", CALL_PROPS, fetchImpl),
    loadAssociated(token, deal.hubspotDealId, "meetings", MEETING_PROPS, fetchImpl),
  ]);

  for (const call of calls) {
    const p = call.properties;
    const transcriptId = p.hs_call_transcription_id || null;
    const recordingUrl = p.hs_call_recording_url || null;
    let transcriptText = stripHtml(p.hs_call_body);
    let transcriptSource = transcriptText ? "call_notes" : null;
    let transcriptAvailable = Boolean(transcriptText?.trim());

    if (transcriptId && canReadTranscripts) {
      const tr = await fetchCallTranscript(token, transcriptId, { fetchImpl });
      if (tr.ok && tr.text) {
        transcriptText = tr.text;
        transcriptSource = tr.source ?? "api_transcript";
        transcriptAvailable = true;
        transcriptsFetched += 1;
      } else if (p.hs_call_has_transcript === "true" || p.hs_call_has_transcript === true) {
        transcriptsUnavailable += 1;
      }
    } else if (
      (p.hs_call_has_transcript === "true" || p.hs_call_has_transcript === true) &&
      !transcriptAvailable
    ) {
      transcriptsUnavailable += 1;
    }

    await prisma.dealRecording.upsert({
      where: {
        dealId_hubspotEngagementId_engagementType: {
          dealId: deal.id,
          hubspotEngagementId: call.id,
          engagementType: "call",
        },
      },
      create: {
        tenantId,
        dealId: deal.id,
        hubspotEngagementId: call.id,
        engagementType: "call",
        title: p.hs_call_title || "Call",
        recordingUrl,
        hubspotTranscriptId: transcriptId,
        transcriptText: transcriptText || null,
        transcriptSource,
        transcriptAvailable,
        payload: p,
        occurredAt: toDate(p.hs_timestamp),
      },
      update: {
        title: p.hs_call_title || "Call",
        recordingUrl,
        hubspotTranscriptId: transcriptId,
        transcriptText: transcriptText || null,
        transcriptSource,
        transcriptAvailable,
        payload: p,
        occurredAt: toDate(p.hs_timestamp),
        syncedAt: new Date(),
      },
    });
    stored += 1;
  }

  for (const meeting of meetings) {
    const p = meeting.properties;
    const notes = meetingNotesText(p);
    const transcriptAvailable = Boolean(notes?.trim());
    const past = isPastMeeting(p);

    if (past && !transcriptAvailable) {
      pastMeetingsWithoutTranscript += 1;
    }

    await prisma.dealRecording.upsert({
      where: {
        dealId_hubspotEngagementId_engagementType: {
          dealId: deal.id,
          hubspotEngagementId: meeting.id,
          engagementType: "meeting",
        },
      },
      create: {
        tenantId,
        dealId: deal.id,
        hubspotEngagementId: meeting.id,
        engagementType: "meeting",
        title: p.hs_meeting_title || "Meeting",
        transcriptText: notes || null,
        transcriptSource: notes ? "meeting_notes" : null,
        transcriptAvailable,
        payload: p,
        occurredAt: toDate(p.hs_meeting_start_time ?? p.hs_timestamp),
      },
      update: {
        title: p.hs_meeting_title || "Meeting",
        transcriptText: notes || null,
        transcriptSource: notes ? "meeting_notes" : null,
        transcriptAvailable,
        payload: p,
        occurredAt: toDate(p.hs_meeting_start_time ?? p.hs_timestamp),
        syncedAt: new Date(),
      },
    });
    stored += 1;
  }

  return {
    dealId,
    calls: calls.length,
    meetings: meetings.length,
    stored,
    transcriptsFetched,
    transcriptsUnavailable,
    pastMeetingsWithoutTranscript,
    canReadTranscripts,
  };
}

/** Sync recordings for all open deals on a tenant. Never throws. */
export async function syncTenantRecordings(prisma, tenantId, token, { scopes = [], fetchImpl = fetch } = {}) {
  const deals = await prisma.deal.findMany({
    where: { tenantId, status: "OPEN" },
    select: { id: true },
  });

  const summaries = [];
  for (const deal of deals) {
    try {
      const s = await syncDealRecordings(prisma, tenantId, deal.id, { token, scopes, fetchImpl });
      summaries.push(s);
    } catch (err) {
      console.warn(`[MOFU] recording sync failed deal=${deal.id}: ${err.message}`);
      summaries.push({ dealId: deal.id, error: err.message });
    }
  }

  return {
    deals: deals.length,
    stored: summaries.reduce((n, s) => n + (s.stored ?? 0), 0),
    transcriptsFetched: summaries.reduce((n, s) => n + (s.transcriptsFetched ?? 0), 0),
    transcriptsUnavailable: summaries.reduce((n, s) => n + (s.transcriptsUnavailable ?? 0), 0),
    pastMeetingsWithoutTranscript: summaries.reduce(
      (n, s) => n + (s.pastMeetingsWithoutTranscript ?? 0),
      0
    ),
    summaries,
  };
}
