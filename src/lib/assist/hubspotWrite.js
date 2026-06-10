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

export function buildContactCreateBody({ email, firstName, lastName, jobTitle, phone, companyName }) {
  const properties = {};
  if (email) properties.email = email;
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (jobTitle) properties.jobtitle = jobTitle;
  if (phone) properties.phone = phone;
  if (companyName) properties.company = companyName;
  return { properties };
}

export function buildCompanyCreateBody({ name, domain, industry }) {
  const properties = { name: name || domain || "(unnamed company)" };
  if (domain) properties.domain = domain;
  if (industry) properties.industry = industry;
  return { properties };
}

export function buildContactSearchByEmail(email) {
  return {
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
    properties: ["email", "firstname", "lastname"],
    limit: 1,
  };
}

export function buildCompanySearchByDomain(domain) {
  return {
    filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
    properties: ["name", "domain"],
    limit: 1,
  };
}

/**
 * Build the body for a HubSpot meeting engagement object.
 *
 * `startTime`/`endTime` may be epoch ms, an ISO string, or a Date — they are
 * normalized to epoch-ms strings (HubSpot's `hs_meeting_*_time` expect ms).
 * `hs_timestamp` (the activity time) defaults to the meeting start. The outcome
 * is SCHEDULED since these meetings are being booked, not logged after the fact.
 */
export function buildMeetingBody({ title, body, startTime, endTime }) {
  const start = toEpochMs(startTime);
  const end = toEpochMs(endTime);
  const properties = {
    hs_meeting_title: title ?? "",
    hs_meeting_body: body ?? "",
    hs_timestamp: start ?? Date.now(),
    hs_meeting_outcome: "SCHEDULED",
  };
  if (start != null) properties.hs_meeting_start_time = start;
  if (end != null) properties.hs_meeting_end_time = end;
  return { properties };
}

/** Coerce a Date | ISO string | epoch-ms (number/string) to epoch-ms, or null. */
function toEpochMs(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  // numeric string → already epoch ms
  if (/^\d+$/.test(v)) return Number(v);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/**
 * Build the body for an email engagement object. This *logs* the email on the
 * HubSpot timeline (it is not an outbound mailbox send — true delivery needs a
 * connected inbox/marketing-send integration, which the MOFU layer does not
 * configure). `hs_email_direction: "EMAIL"` marks it as a logged email.
 */
export function buildEmailEngagementBody({ subject, html, timestamp }) {
  return {
    properties: {
      hs_email_subject: subject ?? "",
      hs_email_html: html ?? "",
      hs_email_direction: "EMAIL",
      hs_timestamp: timestamp ?? Date.now(),
    },
  };
}

/**
 * Build the JSON body for the HubSpot Single Send API
 * (`POST /marketing/v3/transactional/single-email/send`). Pure & testable.
 *
 * `emailId` is the integer id of a saved transactional email; the template
 * references `{{ custom.subject }}` and `{{ custom.body }}`, so subject/html are
 * passed through `customProperties`. Single Send delivers to ONE `to` per call.
 * `replyTo` may be a single address or an array — HubSpot expects an array.
 */
export function buildSingleSendBody({ emailId, to, subject, html, replyTo } = {}) {
  const message = { to };
  if (replyTo != null && replyTo !== "") {
    message.replyTo = Array.isArray(replyTo) ? replyTo : [replyTo];
  }
  return {
    emailId: Number(emailId),
    message,
    customProperties: { subject: subject ?? "", body: html ?? "" },
  };
}

/**
 * Actually DELIVER an email via the HubSpot Single Send (transactional) API.
 * Never throws — degrades gracefully so the caller can fall back to timeline
 * logging:
 *   - success            → { ok:true, status, statusId }
 *   - 403 (no scope/add-on) → { ok:false, reason:"write_scope" }
 *   - any other non-2xx / network error → { ok:false, reason:"send_failed", status, message }
 *
 * Delivers to a SINGLE `to` per call; loop per recipient at the call site.
 */
export async function sendSingleSendEmail(
  token,
  { emailId, to, subject, html, replyTo },
  { fetchImpl = fetch } = {}
) {
  const res = await hsWrite(token, "/marketing/v3/transactional/single-email/send", {
    body: buildSingleSendBody({ emailId, to, subject, html, replyTo }),
    fetchImpl,
  });

  if (!res.ok) {
    if (res.status === 403) return { ok: false, reason: "write_scope" };
    return {
      ok: false,
      reason: "send_failed",
      status: res.status,
      message: res.json?.message ?? res.error ?? null,
    };
  }
  return { ok: true, status: res.json?.status ?? null, statusId: res.json?.statusId ?? null };
}

// ── calls ──────────────────────────────────────────────────────────────────
export async function createDeal(token, input, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/deals", { body: buildDealCreateBody(input), fetchImpl });
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null, json: res.json };
}

export async function createContact(token, input, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/contacts", {
    body: buildContactCreateBody(input),
    fetchImpl,
  });
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null, json: res.json };
}

export async function createCompany(token, input, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(token, "/crm/v3/objects/companies", {
    body: buildCompanyCreateBody(input),
    fetchImpl,
  });
  return { ok: res.ok, status: res.status, id: res.json?.id ?? null, json: res.json };
}

/** Find a HubSpot contact id by email, or null. Never throws. */
export async function searchContactByEmail(token, email, { fetchImpl = fetch } = {}) {
  if (!email) return null;
  const res = await hsWrite(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: buildContactSearchByEmail(email),
    fetchImpl,
  });
  if (!res.ok) return null;
  return res.json?.results?.[0]?.id ?? null;
}

/** Find a HubSpot company id by domain, or null. Never throws. */
export async function searchCompanyByDomain(token, domain, { fetchImpl = fetch } = {}) {
  if (!domain) return null;
  const res = await hsWrite(token, "/crm/v3/objects/companies/search", {
    method: "POST",
    body: buildCompanySearchByDomain(domain),
    fetchImpl,
  });
  if (!res.ok) return null;
  return res.json?.results?.[0]?.id ?? null;
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

/** Associate a contact with a company using the default v4 association. */
export async function associateContactToCompany(token, contactId, companyId, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(
    token,
    `/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
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

/** Associate an email object with another object (deal/contact) using the default v4 association. */
export async function associateEmailTo(token, emailId, toObjectType, toObjectId, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(
    token,
    `/crm/v4/objects/emails/${emailId}/associations/default/${toObjectType}/${toObjectId}`,
    { method: "PUT", body: {}, fetchImpl }
  );
  return { ok: res.ok, status: res.status };
}

/**
 * Log an email engagement on the HubSpot timeline and associate it to the deal
 * (and primary contact, if provided). This records the message as a logged
 * email on the deal/contact timeline — it is *not* an outbound mailbox send.
 * Never throws; returns { ok, status, id }. On a 403 / missing write scope the
 * caller gets ok:false (status 403) so it can degrade gracefully.
 */
export async function logEmailEngagement(
  token,
  { dealId, contactId, subject, html, timestamp },
  { fetchImpl = fetch } = {}
) {
  const res = await hsWrite(token, "/crm/v3/objects/emails", {
    body: buildEmailEngagementBody({ subject, html, timestamp }),
    fetchImpl,
  });
  const id = res.json?.id ?? null;
  if (res.ok && id) {
    if (dealId) await associateEmailTo(token, id, "deals", dealId, { fetchImpl });
    if (contactId) await associateEmailTo(token, id, "contacts", contactId, { fetchImpl });
  }
  return { ok: res.ok, status: res.status, id };
}

/**
 * Create a HubSpot meeting engagement and associate it to the deal and every
 * supplied contact (default v4 associations). Never throws.
 *
 * Returns:
 *   - `{ ok:true, id, status }` on success
 *   - `{ ok:false, reason:"write_scope", status:403 }` on a missing-scope 403 so
 *     the caller can fall back to creating a TASK instead.
 *   - `{ ok:false, reason:"hubspot_error", status }` on any other failure.
 *
 * @param token  decrypted HubSpot token
 * @param input  { dealId, contactIds[], title, body, startTime, endTime }
 *               (dealId / contactIds are HubSpot object ids)
 */
export async function createMeeting(
  token,
  { dealId, contactIds = [], title, body, startTime, endTime },
  { fetchImpl = fetch } = {}
) {
  const res = await hsWrite(token, "/crm/v3/objects/meetings", {
    body: buildMeetingBody({ title, body, startTime, endTime }),
    fetchImpl,
  });

  if (!res.ok) {
    if (res.status === 403) return { ok: false, reason: "write_scope", status: 403 };
    return { ok: false, reason: "hubspot_error", status: res.status };
  }

  const id = res.json?.id ?? null;
  if (id) {
    if (dealId) await associate(token, dealId, "meetings", id, { fetchImpl }).catch(() => {});
    for (const cid of contactIds.filter(Boolean)) {
      await associateMeetingTo(token, id, "contacts", cid, { fetchImpl }).catch(() => {});
    }
  }
  return { ok: true, id, status: res.status };
}

/** Associate a meeting object with another object (deal/contact) via default v4. */
export async function associateMeetingTo(token, meetingId, toObjectType, toObjectId, { fetchImpl = fetch } = {}) {
  const res = await hsWrite(
    token,
    `/crm/v4/objects/meetings/${meetingId}/associations/default/${toObjectType}/${toObjectId}`,
    { method: "PUT", body: {}, fetchImpl }
  );
  return { ok: res.ok, status: res.status };
}
