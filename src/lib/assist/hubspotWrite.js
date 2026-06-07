/**
 * HubSpot write operations for the MOFU layer (deal creation, associations,
 * tasks, notes). Shared by the Deal Workroom (W3) and Lead promotion (L2).
 * Pure body builders are unit-tested; calls take an injectable fetch and never
 * throw — they return { ok, status, … } so callers can degrade gracefully when
 * a write scope is missing.
 */
const HUBSPOT_BASE = "https://api.hubapi.com";

async function hsWrite(token, path, { method = "POST", body, fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`${HUBSPOT_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: err.message };
  }
}

// ── pure body builders ─────────────────────────────────────────────────────
export function buildDealCreateBody({ name, stageId, amount, ownerId, pipeline = "default" }) {
  const properties = { dealname: name, dealstage: stageId, pipeline };
  if (amount !== undefined && amount !== null && amount !== "") properties.amount = String(amount);
  if (ownerId) properties.hubspot_owner_id = ownerId;
  return { properties };
}

export function buildTaskBody({ subject, body, timestamp }) {
  return {
    properties: {
      hs_task_subject: subject,
      hs_task_body: body ?? "",
      hs_task_status: "NOT_STARTED",
      hs_task_type: "TODO",
      hs_timestamp: timestamp ?? Date.now(),
    },
  };
}

export function buildNoteBody({ body, timestamp }) {
  return { properties: { hs_note_body: body, hs_timestamp: timestamp ?? Date.now() } };
}

// ── calls ──────────────────────────────────────────────────────────────────
export async function createDeal(token, input, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/deals", { body: buildDealCreateBody(input), fetchImpl });
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null, json: res.json };
}

/** Associate a deal with a contact or company using the default v4 association. */
export async function associate(token, dealId, toObjectType, toObjectId, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(
    token,
    `/crm/v4/objects/deals/${dealId}/associations/default/${toObjectType}/${toObjectId}`,
    { method: "PUT", body: {}, fetchImpl }
  );
  return { ok: res.ok, status: res.status };
}

/** Create a task and (optionally) associate it to a deal. */
export async function createTask(token, { dealId, subject, body, timestamp }, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/tasks", { body: buildTaskBody({ subject, body, timestamp }), fetchImpl });
  if (res.ok && res.json?.id && dealId) {
    await associate(token, dealId, "tasks", res.json.id, { fetchImpl });
  }
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null };
}

export async function addNote(token, { dealId, body, timestamp }, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/notes", { body: buildNoteBody({ body, timestamp }), fetchImpl });
  if (res.ok && res.json?.id && dealId) {
    await associate(token, dealId, "notes", res.json.id, { fetchImpl });
  }
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null };
}
