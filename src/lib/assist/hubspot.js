/**
 * HubSpot client for the MOFU layer (OAuth bearer token, server-side only).
 * Pure request-shaping + mapping live in hubspotMap.js; this module performs
 * the authenticated HTTP calls (injectable fetch for tests).
 */
import {
  buildOpenDealsSearch,
  buildMqlContactsSearch,
  CONTACT_PROPERTIES,
  COMPANY_PROPERTIES,
} from "@/lib/assist/hubspotMap";

const HUBSPOT_BASE = "https://api.hubapi.com";

async function hsRequest(token, path, { method = "GET", body, fetchImpl = fetch } = {}) {
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
}

/** One lightweight authenticated call to confirm a HubSpot bearer token works. Never throws. */
export async function verifyHubspotToken(token, { fetchImpl = fetch } = {}) {
  try {
    const { ok, status } = await hsRequest(token, "/crm/v3/objects/contacts?limit=1", { fetchImpl });
    return { ok, status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Deal pipelines (for stage → band/status mapping). */
export async function getDealPipelines(token, { fetchImpl = fetch } = {}) {
  const { ok, json } = await hsRequest(token, "/crm/v3/pipelines/deals", { fetchImpl });
  return ok ? json : { results: [] };
}

/** Search open (not closed) deals, optionally scoped to an owner. Returns { results, after }. */
export async function searchOpenDeals(token, { ownerId = null, limit = 100, after, fetchImpl = fetch } = {}) {
  const body = buildOpenDealsSearch({ ownerId, limit, after });
  const { ok, status, json } = await hsRequest(token, "/crm/v3/objects/deals/search", {
    method: "POST",
    body,
    fetchImpl,
  });
  if (!ok) return { ok, status, results: [], after: null };
  return { ok, status, results: json?.results ?? [], after: json?.paging?.next?.after ?? null };
}

/** Search MQL contacts, optionally scoped to an owner. */
export async function searchMqlContacts(token, { ownerId = null, limit = 100, after, fetchImpl = fetch } = {}) {
  const body = buildMqlContactsSearch({ ownerId, limit, after });
  const { ok, status, json } = await hsRequest(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body,
    fetchImpl,
  });
  if (!ok) return { ok, status, results: [], after: null };
  return { ok, status, results: json?.results ?? [], after: json?.paging?.next?.after ?? null };
}

/** Associated company + contact ids for a deal (raw association blocks; dedupe with hubspotMap). */
export async function getDealAssociations(token, dealId, { fetchImpl = fetch } = {}) {
  const { ok, json } = await hsRequest(
    token,
    `/crm/v3/objects/deals/${dealId}?associations=contacts,companies`,
    { fetchImpl }
  );
  return ok ? json?.associations ?? {} : {};
}

async function batchRead(token, objectType, ids, properties, fetchImpl) {
  if (!ids.length) return [];
  const out = [];
  // HubSpot batch read caps at 100 ids/request.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { ok, json } = await hsRequest(token, `/crm/v3/objects/${objectType}/batch/read`, {
      method: "POST",
      body: { properties, inputs: chunk.map((id) => ({ id })) },
      fetchImpl,
    });
    if (ok) out.push(...(json?.results ?? []));
  }
  return out;
}

/** Pure: the owners-by-email lookup URL (requires the `crm.objects.owners.read` scope). */
export function buildOwnersByEmailUrl(email) {
  return `${HUBSPOT_BASE}/crm/v3/owners/?email=${encodeURIComponent(email)}`;
}

/**
 * Resolve the hubspot_owner_id for a user's email, or null. Used to scope the
 * dashboard to "my book". Never throws: a 403 (owners scope not granted), an
 * empty result, or a network error all resolve to null with a console.warn.
 */
export async function resolveOwnerIdByEmail(token, email, { fetchImpl = fetch } = {}) {
  if (!email) return null;
  try {
    const res = await fetchImpl(buildOwnersByEmailUrl(email), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[MOFU] owners lookup failed for ${email} with status ${res.status}`);
      return null;
    }
    const json = await res.json().catch(() => null);
    const first = json?.results?.[0];
    if (!first?.id) {
      console.warn(`[MOFU] owners lookup found no owner for ${email}`);
      return null;
    }
    return String(first.id);
  } catch (err) {
    console.warn(`[MOFU] owners lookup error for ${email}:`, err.message);
    return null;
  }
}

export function getContactsByIds(token, ids, { fetchImpl = fetch } = {}) {
  return batchRead(token, "contacts", ids, CONTACT_PROPERTIES, fetchImpl);
}

export function getCompaniesByIds(token, ids, { fetchImpl = fetch } = {}) {
  return batchRead(token, "companies", ids, COMPANY_PROPERTIES, fetchImpl);
}

export { HUBSPOT_BASE };
