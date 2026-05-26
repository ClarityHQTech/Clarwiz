const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";

function getApiKey() {
  const key =
    process.env.SMARTLEAD_ADMIN_API_KEY?.trim() ||
    process.env.SMARTLEAD_API_KEY?.trim();
  if (!key) {
    throw new Error("SMARTLEAD_ADMIN_API_KEY is not configured");
  }
  return key;
}

async function smartleadRequest(path, { method = "GET", body, query = {} } = {}) {
  const url = new URL(`${SMARTLEAD_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const detail =
      data?.message ||
      data?.error ||
      (typeof data?.raw === "string" ? data.raw.slice(0, 120) : null);
    const message = detail
      ? `Smartlead ${method} ${path} failed (${res.status}): ${detail}`
      : `Smartlead ${method} ${path} failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    err.path = path;
    throw err;
  }

  return data;
}

/** Normalize save/list/get responses — Smartlead uses several shapes. */
export function extractSmartleadAccountPayload(result) {
  if (result == null) return null;

  const nested = [
    result?.data,
    result?.email_account,
    result?.emailAccount,
    result?.data?.email_account,
    result?.data?.emailAccount,
  ];

  for (const item of nested) {
    if (item && (item.id != null || item.email_account_id != null)) {
      return normalizeAccountPayload(item);
    }
  }

  if (result.id != null || result.email_account_id != null) {
    return normalizeAccountPayload(result);
  }

  if (result.emailAccountId != null) {
    return normalizeAccountPayload({
      id: result.emailAccountId,
      from_email: result.from_email,
      is_smtp_success: result.is_smtp_success,
      is_imap_success: result.is_imap_success,
      warmup_details: result.warmup_details,
    });
  }

  return null;
}

function normalizeAccountPayload(account) {
  if (!account) return null;
  const id = account.id ?? account.email_account_id ?? account.emailAccountId;
  if (id == null) return null;
  return { ...account, id: Number(id) || id };
}

export async function listEmailAccounts({ username, limit = 100, offset = 0 } = {}) {
  const data = await smartleadRequest("/email-accounts/", {
    method: "GET",
    query: { limit, offset, ...(username ? { username } : {}) },
  });
  if (Array.isArray(data)) return data;
  return data?.email_accounts ?? data?.accounts ?? data?.data ?? [];
}

function matchAccountEmail(account, normalized) {
  const email = (account?.from_email ?? account?.fromEmail ?? account?.username ?? "")
    .trim()
    .toLowerCase();
  return email === normalized;
}

export async function findEmailAccountByEmail(fromEmail) {
  const normalized = fromEmail?.trim().toLowerCase();
  if (!normalized) return null;

  for (const args of [
    { username: normalized, limit: 20 },
    { limit: 100, offset: 0 },
  ]) {
    const listed = await listEmailAccounts(args);
    const match = listed.find((a) => matchAccountEmail(a, normalized));
    if (match) return normalizeAccountPayload(match);
  }

  return null;
}

/** Verify API key by listing campaigns or email accounts. */
export async function verifySmartleadApiKey() {
  await smartleadRequest("/email-accounts/", { method: "GET" });
  return true;
}

export async function saveEmailAccount(payload) {
  return smartleadRequest("/email-accounts/save", { method: "POST", body: payload });
}

export async function getEmailAccount(emailAccountId) {
  return smartleadRequest(`/email-accounts/${emailAccountId}/`);
}

export async function updateEmailAccount(emailAccountId, payload) {
  return smartleadRequest(`/email-accounts/${emailAccountId}`, {
    method: "POST",
    body: payload,
  });
}

export async function deleteEmailAccount(emailAccountId) {
  return smartleadRequest(`/email-accounts/${emailAccountId}`, {
    method: "DELETE",
  });
}

export async function listCampaigns() {
  const data = await smartleadRequest("/campaigns/");
  if (Array.isArray(data)) return data;
  return data?.campaigns ?? [];
}

export async function getCampaign(campaignId) {
  return smartleadRequest(`/campaigns/${campaignId}`);
}

export async function createCampaign({ name, clientId } = {}) {
  return smartleadRequest("/campaigns/create", {
    method: "POST",
    body: {
      ...(name ? { name } : {}),
      ...(clientId != null ? { client_id: clientId } : {}),
    },
  });
}

export async function setCampaignSequences(campaignId, sequences) {
  return smartleadRequest(`/campaigns/${campaignId}/sequences`, {
    method: "POST",
    body: { sequences },
  });
}

export async function linkCampaignEmailAccounts(campaignId, emailAccountIds) {
  return smartleadRequest(`/campaigns/${campaignId}/email-accounts`, {
    method: "POST",
    body: { email_account_ids: emailAccountIds },
  });
}

export async function setCampaignSchedule(campaignId, schedule) {
  return smartleadRequest(`/campaigns/${campaignId}/schedule`, {
    method: "POST",
    body: schedule,
  });
}

/** POST /campaigns/{id}/settings — track_settings is an array (empty = enable all). */
export async function updateCampaignSettings(campaignId, settings) {
  return smartleadRequest(`/campaigns/${campaignId}/settings`, {
    method: "POST",
    body: settings,
  });
}

/** POST /campaigns/{id}/status — allowed: START, PAUSED, STOPPED */
export async function setCampaignStatus(campaignId, status) {
  const normalized =
    status === "ACTIVE" ? "START" : status === "DRAFTED" ? "PAUSED" : status;
  return smartleadRequest(`/campaigns/${campaignId}/status`, {
    method: "POST",
    body: { status: normalized },
  });
}

export async function updateCampaignLead(campaignId, leadId, payload) {
  return smartleadRequest(`/campaigns/${campaignId}/leads/${leadId}/`, {
    method: "POST",
    body: payload,
  });
}

export async function addCampaignLeads(campaignId, leadList, settings = {}) {
  return smartleadRequest(`/campaigns/${campaignId}/leads`, {
    method: "POST",
    body: {
      lead_list: leadList,
      settings: {
        // false = import leads even when they exist in another Smartlead campaign
        // (true only adds net-new emails; cross-campaign leads land in existingLeadsInOtherCampaigns with total_leads 0)
        ignore_duplicate_leads_in_other_campaign: false,
        return_lead_ids: true,
        ...settings,
      },
    },
  });
}

/** Lead id from POST /campaigns/{id}/leads when return_lead_ids is enabled. */
export function leadIdFromAddLeadsResult(addResult, email) {
  const map = addResult?.emailToLeadIdMap;
  if (!map || !email) return null;
  const key = email.trim().toLowerCase();
  const buckets = [
    map.newlyAddedLeads,
    map.existingLeads,
    map.existingLeadsInOtherCampaigns,
  ];
  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== "object") continue;
    for (const [mapEmail, id] of Object.entries(bucket)) {
      if (mapEmail.trim().toLowerCase() === key && id != null) return id;
    }
  }
  return null;
}

/** Whether the lead was actually attached to this campaign (not only reported in upload_count). */
export function wasLeadAddedToCampaign(addResult, email) {
  if (!addResult?.ok) return false;
  const total = Number(addResult.total_leads ?? 0);
  const already = Number(addResult.already_added_to_campaign ?? 0);
  if (total > 0 || already > 0) return true;

  const map = addResult?.emailToLeadIdMap;
  if (!map || !email) return false;
  const key = email.trim().toLowerCase();
  for (const bucket of [map.newlyAddedLeads, map.existingLeads]) {
    if (!bucket || typeof bucket !== "object") continue;
    for (const mapEmail of Object.keys(bucket)) {
      if (mapEmail.trim().toLowerCase() === key) return true;
    }
  }
  return false;
}

export async function getCampaignLeads(campaignId, { limit = 100, offset = 0 } = {}) {
  return smartleadRequest(`/campaigns/${campaignId}/leads`, {
    method: "GET",
    query: { limit, offset },
  });
}

export async function getCampaignAnalytics(campaignId) {
  return smartleadRequest(`/campaigns/${campaignId}/analytics`);
}

export async function replyEmailThread(campaignId, payload) {
  return smartleadRequest(`/campaigns/${campaignId}/reply-email-thread`, {
    method: "POST",
    body: payload,
  });
}

/** POST master-inbox/sent — track opens, clicks, replies on sent mail */
export async function getInboxSent(payload, { fetchMessageHistory = false } = {}) {
  return smartleadRequest("/master-inbox/sent", {
    method: "POST",
    query: { fetch_message_history: fetchMessageHistory },
    body: payload,
  });
}

/** POST master-inbox/inbox-replies — unified reply inbox */
export async function getInboxReplies(payload, { fetchMessageHistory = false } = {}) {
  return smartleadRequest("/master-inbox/inbox-replies", {
    method: "POST",
    query: { fetch_message_history: fetchMessageHistory },
    body: payload,
  });
}

export function normalizeInboxRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.messages ?? data.data ?? [];
}

export function getLeadEmailFromInboxRow(row) {
  return (row?.lead?.email ?? row?.lead_email ?? row?.email ?? "")
    .trim()
    .toLowerCase();
}

/** Strip HTML and collapse whitespace for reply preview text. */
export function plainTextFromEmailBody(htmlOrText) {
  if (!htmlOrText) return "";
  return String(htmlOrText)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Latest inbound reply body from master-inbox rows (email_history or legacy shapes). */
export function extractReplyBodyFromInboxRow(message) {
  if (!message) return null;

  const history = message.email_history ?? message.message_history ?? [];
  if (Array.isArray(history) && history.length) {
    const replyEvents = history.filter(
      (e) =>
        String(e.type ?? e.direction ?? "").toUpperCase() === "REPLY" ||
        String(e.direction ?? "").toLowerCase() === "inbound"
    );
    const latest = replyEvents[replyEvents.length - 1] ?? null;
    const body = plainTextFromEmailBody(
      latest?.email_body ?? latest?.body ?? latest?.text
    );
    if (body) return body.slice(0, 2000);
  }

  const last = message.last_message ?? {};
  const legacy = plainTextFromEmailBody(last.body ?? last.email_body);
  return legacy ? legacy.slice(0, 2000) : null;
}

export function findInboxRowByEmail(rows, leadEmail) {
  const normalized = leadEmail?.trim().toLowerCase();
  if (!normalized) return null;
  return rows.find((r) => getLeadEmailFromInboxRow(r) === normalized) ?? null;
}

function buildSentInboxFilters({ leadEmail, emailAccountId, smartleadCampaignId, emailStatus }) {
  const search = leadEmail?.trim().slice(0, 30);
  const filters = {};
  if (search) filters.search = search;
  if (emailAccountId != null) filters.emailAccountId = Number(emailAccountId);
  if (smartleadCampaignId != null) filters.campaignId = Number(smartleadCampaignId);
  if (emailStatus != null) filters.emailStatus = emailStatus;
  return filters;
}

/** Find the most recent sent row for a lead email (search max 30 chars). */
export async function findSentMessageForLeadEmail({
  leadEmail,
  emailAccountId,
  smartleadCampaignId,
  emailStatus,
} = {}) {
  const search = leadEmail?.trim().slice(0, 30);
  if (!search) return null;

  const data = await getInboxSent(
    {
      offset: 0,
      limit: 20,
      filters: buildSentInboxFilters({
        leadEmail,
        emailAccountId,
        smartleadCampaignId,
        emailStatus,
      }),
      sortBy: "SENT_TIME_DESC",
    },
    { fetchMessageHistory: false }
  );

  return findInboxRowByEmail(normalizeInboxRows(data), leadEmail);
}

/** Lead row statuses while waiting in Smartlead's send queue. */
const SMARTLEAD_LEAD_QUEUED = new Set(["STARTED", "NOT_CONTACTED", "DRAFTED"]);

export function findCampaignLeadRow(leadsResponse, leadEmail) {
  const rows = leadsResponse?.data ?? leadsResponse?.leads ?? [];
  const normalized = leadEmail?.trim().toLowerCase();
  if (!normalized) return null;
  return (
    rows.find(
      (r) => (r?.lead?.email ?? r?.email ?? "").trim().toLowerCase() === normalized
    ) ?? null
  );
}

export function leadRowSendState(row) {
  if (!row) return "not_found";
  const status = String(row.status ?? "").toUpperCase();
  if (status === "BLOCKED" || status === "BOUNCED") return "failed";
  if (SMARTLEAD_LEAD_QUEUED.has(status)) return "queued";
  return "sent";
}
