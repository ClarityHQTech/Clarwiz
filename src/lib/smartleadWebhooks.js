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
  if (!webhookUrl) return null;

  const needsRefresh = force || smartleadWebhookEventsNeedRefresh(integrationWebhook);

  if (integrationWebhook.providerWebhookId && !needsRefresh) {
    return integrationWebhook.providerWebhookId;
  }

  const result = await createSmartleadWebhook({
    webhookUrl,
    associationType: "user",
    forceCreate: needsRefresh && Boolean(integrationWebhook.providerWebhookId),
  });

  return result?.id ?? result?.webhook_id ?? null;
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
    return result?.id ?? result?.webhook_id ?? null;
  } catch (err) {
    console.warn("[smartlead-webhook]", err.message);
    return null;
  }
}
