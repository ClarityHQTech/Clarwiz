/**
 * HubSpot READ operations for the MOFU post-meeting flow.
 *
 * Pulls a deal's associated meetings + notes (the note-taker output recorded in
 * HubSpot) so the AE doesn't have to paste them by hand. Pure helpers
 * (buildDealAssociationsUrl, stripHtml) are unit-tested; the orchestrator takes
 * an injectable fetch and NEVER throws — 403 / empty / network failures degrade
 * to { ok:false, text:"", sources:[] } with a console.warn so the UI can show a
 * gentle note instead of an error.
 *
 * NOTE: call transcripts/recordings live behind crm.extensions_calling_transcripts
 * (not granted), so they are out of scope here. When that scope is granted we can
 * additionally fetch /crm/v3/objects/calls and their hs_call_body / transcripts.
 */
const HUBSPOT_BASE = "https://api.hubapi.com";

// ── pure helpers ────────────────────────────────────────────────────────────

/** Associations endpoint path for a deal → some object type (e.g. "meetings"). */
export function buildDealAssociationsUrl(dealId, toObjectType) {
  return `/crm/v3/objects/deals/${dealId}/associations/${toObjectType}`;
}

const ENTITIES = [
  [/<br\s*\/?>/gi, "\n"],
  [/<\/(p|div|li|h[1-6])>/gi, "\n"],
  [/<[^>]+>/g, ""],
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
];

/** Strip HTML tags + decode a few common entities to plain text. */
export function stripHtml(s) {
  if (s == null) return "";
  let out = String(s);
  for (const [re, rep] of ENTITIES) out = out.replace(re, rep);
  // collapse runs of blank lines and trim trailing whitespace per line
  return out
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── internal fetch wrappers (never throw) ───────────────────────────────────

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

/** Extract associated object ids from an associations result payload. */
function associationIds(json) {
  const results = json?.results ?? [];
  return results
    .map((r) => r?.toObjectId ?? r?.id ?? r?.to?.id)
    .filter((id) => id != null)
    .map(String);
}

function toMillis(ts) {
  if (ts == null) return 0;
  if (typeof ts === "number") return ts;
  const n = Number(ts);
  if (Number.isFinite(n) && String(ts).trim() !== "") return n;
  const d = Date.parse(ts);
  return Number.isFinite(d) ? d : 0;
}

function fmtDate(ts) {
  const ms = toMillis(ts);
  if (!ms) return "";
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// ── orchestrator ────────────────────────────────────────────────────────────

const MEETING_PROPS = [
  "hs_meeting_title",
  "hs_meeting_body",
  "hs_internal_meeting_notes",
  "hs_meeting_outcome",
  "hs_timestamp",
];
const NOTE_PROPS = ["hs_note_body", "hs_timestamp"];

/**
 * Fetch a deal's associated meeting bodies + notes from HubSpot and return them
 * concatenated newest-first.
 *
 * @returns {Promise<{ ok:boolean, text:string, sources:Array<{type:"meeting"|"note", title?:string, at?:number, body:string}> }>}
 */
export async function fetchDealMeetingNotes(token, hubspotDealId, { fetchImpl = fetch } = {}) {
  const EMPTY = { ok: false, text: "", sources: [] };
  if (!token || !hubspotDealId) return EMPTY;

  try {
    const [meetAssoc, noteAssoc] = await Promise.all([
      hsGet(token, buildDealAssociationsUrl(hubspotDealId, "meetings"), fetchImpl),
      hsGet(token, buildDealAssociationsUrl(hubspotDealId, "notes"), fetchImpl),
    ]);

    // 403 on both → scope almost certainly missing; degrade quietly.
    if (!meetAssoc.ok && !noteAssoc.ok) {
      console.warn(
        `[MOFU] meeting-notes associations failed (meetings ${meetAssoc.status}, notes ${noteAssoc.status})`
      );
      return EMPTY;
    }

    const meetingIds = meetAssoc.ok ? associationIds(meetAssoc.json) : [];
    const noteIds = noteAssoc.ok ? associationIds(noteAssoc.json) : [];

    const [meetings, notes] = await Promise.all([
      meetingIds.length
        ? hsBatchRead(token, "meetings", meetingIds, MEETING_PROPS, fetchImpl)
        : Promise.resolve({ ok: true, json: { results: [] } }),
      noteIds.length
        ? hsBatchRead(token, "notes", noteIds, NOTE_PROPS, fetchImpl)
        : Promise.resolve({ ok: true, json: { results: [] } }),
    ]);

    const sources = [];

    for (const m of meetings.ok ? meetings.json?.results ?? [] : []) {
      const p = m?.properties ?? {};
      const parts = [stripHtml(p.hs_meeting_body), stripHtml(p.hs_internal_meeting_notes)]
        .filter(Boolean);
      const body = parts.join("\n\n");
      if (!body) continue;
      sources.push({
        type: "meeting",
        title: p.hs_meeting_title || "Meeting",
        at: toMillis(p.hs_timestamp),
        body,
      });
    }

    for (const n of notes.ok ? notes.json?.results ?? [] : []) {
      const p = n?.properties ?? {};
      const body = stripHtml(p.hs_note_body);
      if (!body) continue;
      sources.push({
        type: "note",
        title: "Note",
        at: toMillis(p.hs_timestamp),
        body,
      });
    }

    if (sources.length === 0) return EMPTY;

    // newest-first
    sources.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

    const text = sources
      .map((s) => {
        const date = fmtDate(s.at);
        const label = s.type === "note" ? "Note" : s.title;
        const header = date ? `## ${label} (${date})` : `## ${label}`;
        return `${header}\n${s.body}`;
      })
      .join("\n\n");

    return { ok: true, text, sources };
  } catch (err) {
    console.warn(`[MOFU] meeting-notes fetch error: ${err.message}`);
    return EMPTY;
  }
}
