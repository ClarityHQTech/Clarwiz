import { smartleadRequest } from "@/lib/smartleadApi";
import { fullWebhookUrl, WEBHOOK_PROVIDERS } from "@/lib/integrationWebhooks";

/** Events we subscribe to for realtime email activity (Smartlead webhook API). */
export const SMARTLEAD_WEBHOOK_EVENTS = {
  EMAIL_SENT: true,
  EMAIL_OPEN: true,
  EMAIL_LINK_CLICK: true,
  EMAIL_REPLY: true,
};

export const SMARTLEAD_WEBHOOK_EVENT_KEYS = Object.keys(SMARTLEAD_WEBHOOK_EVENTS);

export function smartleadWebhookEventsNeedRefresh(integrationWebhook) {
  const subscribed = integrationWebhook?.eventsSubscribed;
  if (!Array.isArray(subscribed)) return true;
  return !SMARTLEAD_WEBHOOK_EVENT_KEYS.every((key) => subscribed.includes(key));
}

function normalizeWebhookUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/$/, "")
    .toLowerCase();
}

function webhookPathname(url) {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return normalizeWebhookUrl(url);
  }
}

export function extractSmartleadWebhookId(result) {
  if (result == null) return null;
  if (typeof result === "number" || typeof result === "string") {
    const s = String(result).trim();
    return s || null;
  }
  if (typeof result !== "object") return null;

  const candidates = [
    result.id,
    result.webhook_id,
    result.webhookId,
    result.data?.id,
    result.data?.webhook_id,
    result.webhook?.id,
  ];

  for (const value of candidates) {
    if (value != null && value !== "") return String(value);
  }

  return null;
}

function webhookRowsFromListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.webhooks)) return data.webhooks;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.webhooks)) return data.data.webhooks;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function isUserLevelWebhook(row) {
  const assoc = row?.association_type ?? row?.associationType;
  return assoc === "user" || assoc === 1 || assoc === "1";
}

export function findSmartleadWebhookIdByUrl(listResponse, webhookUrl) {
  const targetPath = webhookPathname(webhookUrl);
  const targetFull = normalizeWebhookUrl(webhookUrl);
  if (!targetPath && !targetFull) return null;

  for (const row of webhookRowsFromListResponse(listResponse)) {
    const rowUrl = row.webhook_url ?? row.webhookUrl ?? row.url;
    if (!rowUrl) continue;

    if (
      normalizeWebhookUrl(rowUrl) === targetFull ||
      webhookPathname(rowUrl) === targetPath
    ) {
      return extractSmartleadWebhookId(row);
    }
  }

  return null;
}

export function findUserLevelSmartleadWebhookId(listResponse) {
  for (const row of webhookRowsFromListResponse(listResponse)) {
    if (isUserLevelWebhook(row)) {
      return extractSmartleadWebhookId(row);
    }
  }
  return null;
}

function formatSmartleadError(err) {
  if (!err) return "Could not connect email event tracking";
  const detail =
    err.data?.message ||
    err.data?.error ||
    err.message ||
    "Could not connect email event tracking";
  if (detail.includes("Plan expired")) {
    return "Smartlead API plan expired — renew your Smartlead subscription to register webhooks via API";
  }
  if (detail.includes("Smartlead")) return detail.replace(/^Smartlead POST .* failed \(\d+\): /, "");
  return detail;
}

async function listSmartleadWebhooks() {
  const paths = ["/webhook/list", "/webhooks", "/webhooks/list"];
  let lastError = null;

  for (const path of paths) {
    try {
      const data = await smartleadRequest(path, { method: "GET" });
      const rows = webhookRowsFromListResponse(data);
      if (rows.length > 0) return { data, rows };
      if (data != null && typeof data === "object") return { data, rows };
    } catch (err) {
      lastError = err;
    }
  }

  return { data: null, rows: [], error: lastError };
}

async function updateSmartleadWebhook(webhookId, { webhookUrl } = {}) {
  const body = {
    webhook_url: webhookUrl,
    event_type_map: SMARTLEAD_WEBHOOK_EVENTS,
  };

  return smartleadRequest(`/webhook/update/${webhookId}`, {
    method: "PUT",
    body,
  });
}

export async function createSmartleadWebhook({
  webhookUrl,
  name = "Clarwiz Email Activity",
  associationType = "user",
  smartleadCampaignId,
  forceCreate = true,
}) {
  const body = {
    name,
    webhook_url: webhookUrl,
    association_type: associationType,
    event_type_map: SMARTLEAD_WEBHOOK_EVENTS,
    force_create: forceCreate,
  };

  if (associationType === "campaign") {
    if (!smartleadCampaignId) {
      throw new Error("Campaign id required for campaign-level webhook");
    }
    body.email_campaign_id = Number(smartleadCampaignId);
  }

  return smartleadRequest("/webhook/create", {
    method: "POST",
    body,
  });
}

/**
 * Register a user-level Smartlead webhook so all campaigns send sent/open/click/reply events.
 * @see https://api.smartlead.ai/api-reference/webhooks/create
 */
export async function ensureSmartleadWebhookForTenant({
  integrationWebhook,
  force = false,
}) {
  const webhookUrl = fullWebhookUrl(
    WEBHOOK_PROVIDERS.SMARTLEAD,
    integrationWebhook.webhookToken
  );
  if (!webhookUrl) {
    return { ok: false, error: "App webhook URL is not configured (set NEXT_PUBLIC_URL)" };
  }

  const needsRefresh = force || smartleadWebhookEventsNeedRefresh(integrationWebhook);

  if (integrationWebhook.providerWebhookId && !needsRefresh) {
    return { ok: true, providerId: String(integrationWebhook.providerWebhookId) };
  }

  const storedId = integrationWebhook.providerWebhookId
    ? String(integrationWebhook.providerWebhookId)
    : null;

  if (storedId) {
    try {
      await updateSmartleadWebhook(storedId, { webhookUrl });
      return { ok: true, providerId: storedId };
    } catch (err) {
      console.warn("[smartlead-webhook] update stored webhook failed:", err.message);
    }
  }

  let lastError = null;

  try {
    const result = await createSmartleadWebhook({
      webhookUrl,
      associationType: "user",
      forceCreate: true,
    });
    const createdId = extractSmartleadWebhookId(result);
    if (createdId) return { ok: true, providerId: createdId };

    lastError = new Error(
      `Create succeeded but no webhook id in response: ${JSON.stringify(result)?.slice(0, 200)}`
    );
  } catch (err) {
    lastError = err;
    console.warn("[smartlead-webhook] create failed:", err.message);
  }

  const { rows, error: listError } = await listSmartleadWebhooks();
  if (listError && !rows.length) {
    lastError = lastError ?? listError;
  }

  const byUrl = findSmartleadWebhookIdByUrl(rows.length ? rows : null, webhookUrl);
  if (byUrl) {
    try {
      await updateSmartleadWebhook(byUrl, { webhookUrl });
    } catch (err) {
      console.warn("[smartlead-webhook] update matched webhook failed:", err.message);
    }
    return { ok: true, providerId: byUrl };
  }

  const userLevelId = findUserLevelSmartleadWebhookId(rows);
  if (userLevelId) {
    try {
      await updateSmartleadWebhook(userLevelId, { webhookUrl });
      return { ok: true, providerId: userLevelId };
    } catch (err) {
      lastError = err;
      console.warn("[smartlead-webhook] update user webhook failed:", err.message);
    }
  }

  return {
    ok: false,
    error: formatSmartleadError(lastError),
    detail: lastError?.message ?? null,
  };
}

/** @deprecated Prefer ensureSmartleadWebhookForTenant (user-level covers all campaigns). */
export async function ensureSmartleadWebhookForCampaign({
  smartleadCampaignId,
  integrationWebhook,
}) {
  const webhookUrl = fullWebhookUrl(
    WEBHOOK_PROVIDERS.SMARTLEAD,
    integrationWebhook.webhookToken
  );
  if (!webhookUrl || !smartleadCampaignId) return null;

  try {
    const result = await createSmartleadWebhook({
      webhookUrl,
      smartleadCampaignId,
      associationType: "campaign",
    });
    return extractSmartleadWebhookId(result);
  } catch (err) {
    console.warn("[smartlead-webhook]", err.message);
    return null;
  }
}
