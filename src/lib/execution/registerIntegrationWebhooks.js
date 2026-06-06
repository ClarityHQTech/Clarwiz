import { prisma } from "@/lib/prisma";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { getEmailIntegration } from "@/lib/emailIntegration";
import { getWhatsAppIntegration } from "@/lib/whatsappIntegration";
import { linkupCreateWebhook } from "@/lib/linkupApi";
import {
  ensureWebhooksForConnectedChannels,
  fullWebhookUrl,
  getOrCreateIntegrationWebhook,
  hasMetaVerifyToken,
  upsertWebhookSecrets,
  WEBHOOK_PROVIDERS,
} from "@/lib/integrationWebhooks";
import { ensureSmartleadWebhookForTenant, smartleadWebhookEventsNeedRefresh } from "@/lib/smartleadWebhooks";

function needsRefreshMessage(wh, force) {
  if (force || smartleadWebhookEventsNeedRefresh(wh)) {
    return "Email event tracking updated";
  }
  return "Email event tracking connected";
}

export async function registerWebhookForProvider(
  tenantId,
  provider,
  { campaignId, force = false } = {}
) {
  if (provider === WEBHOOK_PROVIDERS.SMARTLEAD) {
    const email = await getEmailIntegration(tenantId);
    if (email?.status !== "connected" || !email?.hasSmartleadAccount) {
      return {
        provider,
        ok: false,
        error: "Connect your email inbox first",
        manualSetupRequired: false,
      };
    }

    const wh = await getOrCreateIntegrationWebhook(
      tenantId,
      WEBHOOK_PROVIDERS.SMARTLEAD
    );
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.SMARTLEAD, wh.webhookToken);
    await prisma.integrationWebhook.update({
      where: { id: wh.id },
      data: { webhookUrl },
    });

    if (wh.providerWebhookId && !force && !smartleadWebhookEventsNeedRefresh(wh)) {
      return { provider, ok: true, message: "Email event tracking already connected" };
    }

    try {
      const outcome = await ensureSmartleadWebhookForTenant({
        integrationWebhook: wh,
        force,
      });

      if (!outcome.ok || !outcome.providerId) {
        await prisma.integrationWebhook.update({
          where: { id: wh.id },
          data: {
            lastError: outcome.error ?? "Could not connect email event tracking",
          },
        });
        return {
          provider,
          ok: false,
          error: outcome.error ?? "Could not connect email event tracking",
          manualSetupRequired: false,
        };
      }

      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: {
          status: "connected",
          providerWebhookId: String(outcome.providerId),
          webhookUrl,
          lastError: null,
          eventsSubscribed: [
            "EMAIL_SENT",
            "EMAIL_OPEN",
            "EMAIL_LINK_CLICK",
            "EMAIL_REPLY",
          ],
        },
      });

      return {
        provider,
        ok: true,
        message: needsRefreshMessage(wh, force),
      };
    } catch (err) {
      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: { lastError: err.message },
      });
      return {
        provider,
        ok: false,
        error: err.message?.includes("Plan expired")
          ? "Smartlead API plan expired — renew your Smartlead subscription to register webhooks"
          : err.message || "Could not connect email event tracking",
        manualSetupRequired: false,
      };
    }
  }

  if (provider === WEBHOOK_PROVIDERS.LINKUP) {
    const linkedin = await getLinkedInIntegrationWithAccountId(tenantId);
    if (linkedin?.status !== "connected" || !linkedin?.linkupAccountIdPlain) {
      return {
        provider,
        ok: false,
        error: "Connect LinkedIn first",
      };
    }

    const wh = await getOrCreateIntegrationWebhook(tenantId, WEBHOOK_PROVIDERS.LINKUP);
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.LINKUP, wh.webhookToken);

    if (wh.providerWebhookId && !force) {
      return { provider, ok: true, message: "Webhook already registered" };
    }

    try {
      const created = await linkupCreateWebhook({
        accountId: linkedin.linkupAccountIdPlain,
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
          lastError: null,
          eventsSubscribed: ["message_received", "accepted_invitation"],
        },
      });
      return { provider, ok: true };
    } catch (err) {
      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: { lastError: err.message },
      });
      return { provider, ok: false, error: err.message };
    }
  }

  if (provider === WEBHOOK_PROVIDERS.WHATSAPP_META) {
    const whatsapp = await getWhatsAppIntegration(tenantId);
    if (whatsapp?.status !== "connected" || whatsapp?.mode !== "meta") {
      return {
        provider,
        ok: false,
        error: "Connect Meta WhatsApp first",
      };
    }

    const hasToken = await hasMetaVerifyToken(tenantId);
    if (!hasToken) {
      return {
        provider,
        ok: false,
        error:
          "Save your Meta webhook verify token when connecting WhatsApp (same value as in Meta Developer Console)",
        manualSetupRequired: true,
      };
    }

    const wh = await getOrCreateIntegrationWebhook(
      tenantId,
      WEBHOOK_PROVIDERS.WHATSAPP_META
    );
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.WHATSAPP_META, wh.webhookToken);
    await prisma.integrationWebhook.update({
      where: { id: wh.id },
      data: { webhookUrl },
    });

    return {
      provider,
      ok: true,
      pending: true,
      manualSetupRequired: true,
      message:
        "Add the callback URL in Meta Developer Console using your saved verify token. Status updates when the first event arrives.",
    };
  }

  if (provider === WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT) {
    const whatsapp = await getWhatsAppIntegration(tenantId);
    if (whatsapp?.status !== "connected" || whatsapp?.mode !== "interakt") {
      return {
        provider,
        ok: false,
        error: "Connect Interakt WhatsApp first",
      };
    }

    const wh = await getOrCreateIntegrationWebhook(
      tenantId,
      WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT
    );
    const webhookUrl = fullWebhookUrl(
      WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT,
      wh.webhookToken
    );
    await prisma.integrationWebhook.update({
      where: { id: wh.id },
      data: { webhookUrl },
    });

    return {
      provider,
      ok: true,
      pending: true,
      manualSetupRequired: true,
      message:
        "Add the webhook URL in Interakt Developer Settings. Status updates when the first event arrives.",
    };
  }

  return { provider, ok: false, error: "Unknown webhook provider" };
}

export async function registerWebhooksForTenant(tenantId, { campaignId } = {}) {
  await ensureWebhooksForConnectedChannels(tenantId);

  const results = [];
  const email = await getEmailIntegration(tenantId);
  if (email?.status === "connected" && email?.hasSmartleadAccount) {
    results.push(
      await registerWebhookForProvider(tenantId, WEBHOOK_PROVIDERS.SMARTLEAD, {
        campaignId,
      })
    );
  }

  const linkedin = await getLinkedInIntegrationWithAccountId(tenantId);
  if (linkedin?.status === "connected" && linkedin?.linkupAccountIdPlain) {
    results.push(
      await registerWebhookForProvider(tenantId, WEBHOOK_PROVIDERS.LINKUP)
    );
  }

  const whatsapp = await getWhatsAppIntegration(tenantId);
  if (whatsapp?.status === "connected") {
    if (whatsapp.mode === "meta") {
      results.push(
        await registerWebhookForProvider(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META)
      );
    } else if (whatsapp.mode === "interakt") {
      results.push(
        await registerWebhookForProvider(
          tenantId,
          WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT
        )
      );
    }
  }

  return results;
}
