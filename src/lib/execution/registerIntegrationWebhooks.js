import { prisma } from "@/lib/prisma";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { getEmailIntegration } from "@/lib/emailIntegration";
import { linkupCreateWebhook } from "@/lib/linkupApi";
import {
  fullWebhookUrl,
  getOrCreateIntegrationWebhook,
  upsertWebhookSecrets,
  WEBHOOK_PROVIDERS,
} from "@/lib/integrationWebhooks";
import { ensureSmartleadWebhookForCampaign } from "@/lib/smartleadWebhooks";

export async function registerWebhooksForTenant(tenantId, { campaignId } = {}) {
  const results = [];

  const email = await getEmailIntegration(tenantId);
  if (email?.status === "connected" && email?.hasSmartleadAccount) {
    const wh = await getOrCreateIntegrationWebhook(
      tenantId,
      WEBHOOK_PROVIDERS.SMARTLEAD
    );
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { smartleadCampaignId: true },
      });
      if (campaign?.smartleadCampaignId) {
        const providerId = await ensureSmartleadWebhookForCampaign({
          tenantId,
          smartleadCampaignId: campaign.smartleadCampaignId,
          integrationWebhook: wh,
        });
        if (providerId) {
          await prisma.integrationWebhook.update({
            where: { id: wh.id },
            data: {
              status: "connected",
              providerWebhookId: String(providerId),
              webhookUrl: fullWebhookUrl(WEBHOOK_PROVIDERS.SMARTLEAD, wh.webhookToken),
              eventsSubscribed: [
                "EMAIL_SENT",
                "EMAIL_OPEN",
                "EMAIL_REPLY",
                "EMAIL_BOUNCE",
                "EMAIL_LINK_CLICK",
                "LEAD_UNSUBSCRIBED",
              ],
            },
          });
          results.push({ provider: "smartlead", ok: true });
        }
      }
    }
  }

  const linkedin = await getLinkedInIntegrationWithAccountId(tenantId);
  if (linkedin?.status === "connected" && linkedin?.linkupAccountIdPlain) {
    const wh = await getOrCreateIntegrationWebhook(tenantId, WEBHOOK_PROVIDERS.LINKUP);
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.LINKUP, wh.webhookToken);
    if (webhookUrl && !wh.providerWebhookId) {
      try {
        const accountId = linkedin.linkupAccountIdPlain;
        const created = await linkupCreateWebhook({
          accountId,
          url: webhookUrl,
          events: ["message_received", "accepted_invitation"],
          enableSignature: true,
        });
        const secret = created?.data?.secret;
        if (secret) {
          await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.LINKUP, {
            signingSecret: secret,
          });
        }
        await prisma.integrationWebhook.update({
          where: { id: wh.id },
          data: {
            status: "connected",
            providerWebhookId: created?.data?.webhook_id ?? null,
            webhookUrl,
            eventsSubscribed: ["message_received", "accepted_invitation"],
          },
        });
        results.push({ provider: "linkup", ok: true });
      } catch (err) {
        await prisma.integrationWebhook.update({
          where: { id: wh.id },
          data: { lastError: err.message },
        });
        results.push({ provider: "linkup", ok: false, error: err.message });
      }
    }
  }

  return results;
}
