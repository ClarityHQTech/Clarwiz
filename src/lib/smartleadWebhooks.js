import { smartleadRequest } from "@/lib/smartleadApi";
import { fullWebhookUrl, WEBHOOK_PROVIDERS } from "@/lib/integrationWebhooks";

const DEFAULT_EVENTS = {
  EMAIL_SENT: true,
  EMAIL_OPEN: true,
  EMAIL_REPLY: true,
  EMAIL_BOUNCE: true,
  EMAIL_LINK_CLICK: true,
  LEAD_UNSUBSCRIBED: true,
};

export async function createSmartleadWebhook({
  webhookUrl,
  smartleadCampaignId,
  name = "Clarwiz Campaign Tracking",
}) {
  return smartleadRequest("/webhook/create", {
    method: "POST",
    body: {
      name,
      webhook_url: webhookUrl,
      association_type: "campaign",
      email_campaign_id: smartleadCampaignId,
      event_type_map: DEFAULT_EVENTS,
    },
  });
}

export async function ensureSmartleadWebhookForCampaign({
  tenantId,
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
    });
    return result?.id ?? result?.webhook_id ?? null;
  } catch (err) {
    console.warn("[smartlead-webhook]", err.message);
    return null;
  }
}
