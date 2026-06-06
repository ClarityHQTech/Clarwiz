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
  return [];
}

export function findSmartleadWebhookIdByUrl(listResponse, webhookUrl) {
  const target = normalizeWebhookUrl(webhookUrl);
  if (!target) return null;

  for (const row of webhookRowsFromListResponse(listResponse)) {
    const rowUrl = normalizeWebhookUrl(
      row.webhook_url ?? row.webhookUrl ?? row.url
    );
    if (rowUrl && rowUrl === target) {
      return extractSmartleadWebhookId(row);
    }
  }

  return null;
}

async function listSmartleadWebhooks() {
  const paths = ["/webhooks", "/webhook/list", "/webhooks/list"];
  let lastError = null;

  for (const path of paths) {
    try {
      const data = await smartleadRequest(path, { method: "GET" });
      const rows = webhookRowsFromListResponse(data);
      if (rows.length > 0 || data != null) return data;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    console.warn("[smartlead-webhook] list failed:", lastError.message);
  }
  return null;
}

async function updateSmartleadWebhook(webhookId, { webhookUrl, forceCreate = false } = {}) {
  const body = {
    webhook_url: webhookUrl,
    event_type_map: SMARTLEAD_WEBHOOK_EVENTS,
    ...(forceCreate ? { force_create: true } : {}),
  };

  const paths = [`/webhooks/${webhookId}`, `/webhook/update`];
  let lastError = null;

  for (const path of paths) {
    try {
      const payload =
        path === "/webhook/update"
          ? { webhook_id: Number(webhookId), ...body }
          : body;
      return await smartleadRequest(path, {
        method: path === "/webhook/update" ? "POST" : "PATCH",
        body: payload,
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Failed to update Smartlead webhook");
}

export async function createSmartleadWebhook({
  webhookUrl,
  name = "Clarwiz Email Activity",
  associationType = "user",
  smartleadCampaignId,
  forceCreate = false,
}) {
  const body = {
    name,
    webhook_url: webhookUrl,
    association_type: associationType,
    event_type_map: SMARTLEAD_WEBHOOK_EVENTS,
  };

  if (associationType === "campaign") {
    if (!smartleadCampaignId) {
      throw new Error("Campaign id required for campaign-level webhook");
    }
    body.email_campaign_id = Number(smartleadCampaignId);
  }

  if (forceCreate) {
    body.force_create = true;
  }

  const paths = ["/webhook/create", "/webhooks"];
  let lastError = null;

  for (const path of paths) {
    try {
      return await smartleadRequest(path, { method: "POST", body });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Failed to create Smartlead webhook");
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
  if (!webhookUrl) return null;

  const needsRefresh = force || smartleadWebhookEventsNeedRefresh(integrationWebhook);

  if (integrationWebhook.providerWebhookId && !needsRefresh) {
    return integrationWebhook.providerWebhookId;
  }

  const storedId = integrationWebhook.providerWebhookId
    ? String(integrationWebhook.providerWebhookId)
    : null;

  if (storedId && needsRefresh) {
    try {
      await updateSmartleadWebhook(storedId, {
        webhookUrl,
        forceCreate: true,
      });
      return storedId;
    } catch (err) {
      console.warn(
        "[smartlead-webhook] update stored webhook failed:",
        err.message
      );
    }
  }

  try {
    const result = await createSmartleadWebhook({
      webhookUrl,
      associationType: "user",
      forceCreate: needsRefresh && Boolean(storedId),
    });
    const createdId = extractSmartleadWebhookId(result);
    if (createdId) return createdId;

    console.warn(
      "[smartlead-webhook] create returned no id:",
      JSON.stringify(result)?.slice(0, 300)
    );
  } catch (err) {
    console.warn("[smartlead-webhook] create failed:", err.message);
  }

  const list = await listSmartleadWebhooks();
  const existingId = findSmartleadWebhookIdByUrl(list, webhookUrl);
  if (existingId) {
    if (needsRefresh) {
      try {
        await updateSmartleadWebhook(existingId, {
          webhookUrl,
          forceCreate: true,
        });
      } catch (err) {
        console.warn(
          "[smartlead-webhook] update existing webhook failed:",
          err.message
        );
      }
    }
    return existingId;
  }

  return null;
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
