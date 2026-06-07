import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "@/lib/encryptSecret";
import { getAppBaseUrl } from "@/lib/cronAuth";
import { getCalendlyIntegration } from "@/lib/calendlyIntegration";
import { getEmailIntegration } from "@/lib/emailIntegration";
import { getLinkedInIntegration } from "@/lib/linkedinIntegration";
import { getWhatsAppIntegration } from "@/lib/whatsappIntegration";

export const WEBHOOK_PROVIDERS = {
  SMARTLEAD: "smartlead",
  LINKUP: "linkup",
  WHATSAPP_META: "whatsapp_meta",
  WHATSAPP_INTERAKT: "whatsapp_interakt",
  CALENDLY: "calendly",
};

export const WEBHOOK_CAPABILITIES = {
  [WEBHOOK_PROVIDERS.SMARTLEAD]: [
    "email_sent",
    "email_open",
    "link_click",
    "email_reply",
  ],
  [WEBHOOK_PROVIDERS.LINKUP]: ["message_received", "accepted_invitation"],
  [WEBHOOK_PROVIDERS.WHATSAPP_META]: ["delivery", "read", "inbound_reply"],
  [WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT]: [
    "delivery",
    "read",
    "template_status",
    "inbound_reply",
  ],
  [WEBHOOK_PROVIDERS.CALENDLY]: ["invitee.created", "invitee.canceled"],
};

export const WEBHOOK_SETUP = {
  [WEBHOOK_PROVIDERS.SMARTLEAD]: {
    label: "Email",
    autoRegisterSupported: true,
    manualSetupRequired: false,
    showWebhookUrl: false,
    showUserSetup: false,
    setupInstructions:
      "Tracks email sent, opens, link clicks, and replies for your campaigns.",
    docsUrl: null,
  },
  [WEBHOOK_PROVIDERS.LINKUP]: {
    label: "LinkedIn",
    autoRegisterSupported: true,
    manualSetupRequired: false,
    showWebhookUrl: false,
    showUserSetup: false,
    setupInstructions:
      "Message and connection event tracking is configured automatically when you connect LinkedIn.",
    docsUrl: null,
  },
  [WEBHOOK_PROVIDERS.WHATSAPP_META]: {
    label: "WhatsApp (Meta)",
    autoRegisterSupported: false,
    manualSetupRequired: true,
    showWebhookUrl: true,
    showUserSetup: true,
    setupInstructions:
      "In Meta Developer Console → WhatsApp → Configuration, add this callback URL. Use the same verify token you entered when connecting WhatsApp (stored encrypted in Clarwiz). Subscribe to the messages field.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks",
  },
  [WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT]: {
    label: "WhatsApp (Interakt)",
    autoRegisterSupported: false,
    manualSetupRequired: true,
    showWebhookUrl: true,
    showUserSetup: true,
    setupInstructions:
      "In Interakt Developer Settings, add this webhook URL and enable message_received for inbound replies and delivery events.",
    docsUrl: "https://app.interakt.ai/settings/developer-setting",
  },
  [WEBHOOK_PROVIDERS.CALENDLY]: {
    label: "Calendly",
    autoRegisterSupported: true,
    manualSetupRequired: false,
    showWebhookUrl: false,
    showUserSetup: false,
    setupInstructions:
      "Booking event tracking is configured automatically when you connect Calendly Standard+.",
    docsUrl: null,
  },
};

export function publicWebhookBaseUrl() {
  return getAppBaseUrl();
}

export function webhookPathForProvider(provider, webhookToken) {
  if (provider === WEBHOOK_PROVIDERS.SMARTLEAD) {
    return `/api/webhooks/smartlead/${webhookToken}`;
  }
  if (provider === WEBHOOK_PROVIDERS.LINKUP) {
    return `/api/webhooks/linkup/${webhookToken}`;
  }
  if (provider === WEBHOOK_PROVIDERS.WHATSAPP_META) {
    return "/api/integrations/whatsapp/meta/webhook";
  }
  if (provider === WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT) {
    return "/api/integrations/whatsapp/interakt/webhook";
  }
  if (provider === WEBHOOK_PROVIDERS.CALENDLY) {
    return "/api/webhooks/calendly";
  }
  return null;
}

export function fullWebhookUrl(provider, webhookToken) {
  const path = webhookPathForProvider(provider, webhookToken);
  if (!path) return null;
  return `${publicWebhookBaseUrl()}${path}`;
}

export async function getOrCreateIntegrationWebhook(tenantId, provider) {
  let row = await prisma.integrationWebhook.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });

  if (!row) {
    row = await prisma.integrationWebhook.create({
      data: {
        tenantId,
        provider,
        webhookToken: randomBytes(16).toString("hex"),
        status: "pending",
      },
    });
  }

  return row;
}

export async function findWebhookByToken(webhookToken) {
  return prisma.integrationWebhook.findUnique({
    where: { webhookToken },
    include: { tenant: true },
  });
}

export function getDecryptedSigningSecret(record) {
  if (!record?.encryptedSigningSecret) return null;
  return decryptWebhookSecret(record.encryptedSigningSecret);
}

export function getDecryptedVerifyToken(record) {
  if (!record?.encryptedVerifyToken) return null;
  return decryptWebhookSecret(record.encryptedVerifyToken);
}

export async function upsertWebhookSecrets(tenantId, provider, { signingSecret, verifyToken } = {}) {
  const row = await getOrCreateIntegrationWebhook(tenantId, provider);
  const data = { updatedAt: new Date() };
  if (signingSecret) {
    data.encryptedSigningSecret = encryptWebhookSecret(signingSecret);
  }
  if (verifyToken) {
    data.encryptedVerifyToken = encryptWebhookSecret(verifyToken);
  }
  return prisma.integrationWebhook.update({
    where: { id: row.id },
    data,
  });
}

export async function saveMetaVerifyToken(tenantId, verifyToken) {
  const token = verifyToken?.trim();
  if (!token) {
    throw new Error("Webhook verify token is required");
  }
  await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META, {
    verifyToken: token,
  });
  return true;
}

export async function hasMetaVerifyToken(tenantId) {
  const row = await prisma.integrationWebhook.findUnique({
    where: {
      tenantId_provider: { tenantId, provider: WEBHOOK_PROVIDERS.WHATSAPP_META },
    },
  });
  return Boolean(getDecryptedVerifyToken(row));
}

export async function markWebhookEvent(tenantId, provider, { error = null } = {}) {
  const row = await prisma.integrationWebhook.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
  if (!row) return;
  await prisma.integrationWebhook.update({
    where: { id: row.id },
    data: {
      lastEventAt: error ? row.lastEventAt : new Date(),
      lastError: error,
      status: error ? row.status : "connected",
    },
  });
}

/** Meta/Interakt manual webhooks: record successful provider verification (GET challenge). */
export async function markWebhookVerified(tenantId, provider) {
  const row = await prisma.integrationWebhook.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
  if (!row) return;

  const priorMeta =
    row.providerMeta && typeof row.providerMeta === "object" && !Array.isArray(row.providerMeta)
      ? row.providerMeta
      : {};

  await prisma.integrationWebhook.update({
    where: { id: row.id },
    data: {
      status: "connected",
      lastError: null,
      providerMeta: {
        ...priorMeta,
        verifiedAt: priorMeta.verifiedAt ?? new Date().toISOString(),
      },
    },
  });
}

export async function bootstrapWebhookSecretsFromEnv(tenantId) {
  const interaktSecret = process.env.INTERAKT_WEBHOOK_SECRET?.trim();
  if (interaktSecret) {
    const interaktRow = await prisma.integrationWebhook.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT,
        },
      },
    });
    if (!interaktRow?.encryptedSigningSecret) {
      await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT, {
        signingSecret: interaktSecret,
      });
    }
  }

  const metaVerify =
    process.env.WHATSAPP_META_VERIFY_TOKEN?.trim() ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (metaVerify) {
    const metaRow = await prisma.integrationWebhook.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: WEBHOOK_PROVIDERS.WHATSAPP_META,
        },
      },
    });
    if (!metaRow?.encryptedVerifyToken) {
      await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META, {
        verifyToken: metaVerify,
      });
    }
  }
}

function computeWebhookDisplayStatus(row, { channelConnected, calendlyWebhooksActive } = {}) {
  if (!channelConnected) return "not_configured";
  if (calendlyWebhooksActive) return "connected";

  const verifiedAt =
    row.providerMeta &&
    typeof row.providerMeta === "object" &&
    !Array.isArray(row.providerMeta)
      ? row.providerMeta.verifiedAt
      : null;

  if (
    row.lastEventAt ||
    row.providerWebhookId ||
    row.status === "connected" ||
    verifiedAt
  ) {
    return "connected";
  }
  if (row.lastError) return "error";
  return "pending";
}

function sanitizeWebhookError(provider, lastError) {
  if (!lastError) return null;
  if (provider === WEBHOOK_PROVIDERS.SMARTLEAD) {
    return "Could not set up email event tracking. Try again or contact support.";
  }
  if (provider === WEBHOOK_PROVIDERS.LINKUP) {
    return "Could not set up LinkedIn event tracking. Use Connect webhook to retry.";
  }
  return lastError;
}

function serializeWebhookRow(row, { channelConnected = true, calendlyWebhooksActive = false } = {}) {
  const setup = WEBHOOK_SETUP[row.provider] ?? {};
  const webhookUrl =
    row.webhookUrl || fullWebhookUrl(row.provider, row.webhookToken);
  const displayStatus = computeWebhookDisplayStatus(row, {
    channelConnected,
    calendlyWebhooksActive,
  });

  const verifiedAt =
    row.providerMeta &&
    typeof row.providerMeta === "object" &&
    !Array.isArray(row.providerMeta)
      ? row.providerMeta.verifiedAt
      : null;

  return {
    id: row.id,
    provider: row.provider,
    label: setup.label ?? row.provider,
    status: row.status,
    displayStatus,
    channelConnected,
    webhookUrl: setup.showWebhookUrl === false ? null : webhookUrl,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    verifiedAt: verifiedAt ? String(verifiedAt) : null,
    lastError: sanitizeWebhookError(row.provider, row.lastError),
    eventsSubscribed:
      row.eventsSubscribed ?? WEBHOOK_CAPABILITIES[row.provider] ?? [],
    canRead: WEBHOOK_CAPABILITIES[row.provider] ?? [],
    hasSigningSecret: Boolean(row.encryptedSigningSecret),
    hasVerifyToken: Boolean(row.encryptedVerifyToken),
    autoRegisterSupported: setup.autoRegisterSupported ?? false,
    manualSetupRequired: setup.manualSetupRequired ?? false,
    showWebhookUrl: setup.showWebhookUrl !== false,
    showUserSetup: setup.showUserSetup !== false,
    setupInstructions: setup.setupInstructions ?? null,
    docsUrl: setup.showUserSetup === false ? null : setup.docsUrl ?? null,
    providerWebhookId: row.providerWebhookId,
  };
}

export async function ensureWebhooksForConnectedChannels(tenantId) {
  const [email, linkedin, whatsapp] = await Promise.all([
    getEmailIntegration(tenantId),
    getLinkedInIntegration(tenantId),
    getWhatsAppIntegration(tenantId),
  ]);

  if (email?.status === "connected" && email?.hasSmartleadAccount) {
    const wh = await getOrCreateIntegrationWebhook(
      tenantId,
      WEBHOOK_PROVIDERS.SMARTLEAD
    );
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.SMARTLEAD, wh.webhookToken);
    if (webhookUrl && wh.webhookUrl !== webhookUrl) {
      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: { webhookUrl },
      });
    }
  }

  if (linkedin?.status === "connected") {
    const wh = await getOrCreateIntegrationWebhook(tenantId, WEBHOOK_PROVIDERS.LINKUP);
    const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.LINKUP, wh.webhookToken);
    if (webhookUrl && wh.webhookUrl !== webhookUrl) {
      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: { webhookUrl },
      });
    }
  }

  if (whatsapp?.status === "connected") {
    if (whatsapp.mode === "meta") {
      const wh = await getOrCreateIntegrationWebhook(
        tenantId,
        WEBHOOK_PROVIDERS.WHATSAPP_META
      );
      const webhookUrl = fullWebhookUrl(WEBHOOK_PROVIDERS.WHATSAPP_META, wh.webhookToken);
      await prisma.integrationWebhook.update({
        where: { id: wh.id },
        data: { webhookUrl },
      });
    } else if (whatsapp.mode === "interakt") {
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
    }
  }
}

export async function listWebhooksForTenant(tenantId) {
  await ensureWebhooksForConnectedChannels(tenantId);

  const [rows, email, linkedin, whatsapp, calendly] = await Promise.all([
    prisma.integrationWebhook.findMany({
      where: { tenantId },
      orderBy: { provider: "asc" },
    }),
    getEmailIntegration(tenantId),
    getLinkedInIntegration(tenantId),
    getWhatsAppIntegration(tenantId),
    getCalendlyIntegration(tenantId),
  ]);

  const channelConnected = {
    [WEBHOOK_PROVIDERS.SMARTLEAD]:
      email?.status === "connected" && email?.hasSmartleadAccount,
    [WEBHOOK_PROVIDERS.LINKUP]: linkedin?.status === "connected",
    [WEBHOOK_PROVIDERS.WHATSAPP_META]:
      whatsapp?.status === "connected" && whatsapp?.mode === "meta",
    [WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT]:
      whatsapp?.status === "connected" && whatsapp?.mode === "interakt",
    [WEBHOOK_PROVIDERS.CALENDLY]:
      calendly?.status === "connected" && calendly?.webhooksActive,
  };

  const serialized = rows
    .filter((row) => channelConnected[row.provider] === true)
    .map((row) =>
      serializeWebhookRow(row, {
        channelConnected: channelConnected[row.provider] ?? true,
      })
    );

  if (calendly?.status === "connected" && calendly?.webhooksActive) {
    const setup = WEBHOOK_SETUP[WEBHOOK_PROVIDERS.CALENDLY];
    serialized.push({
      id: `calendly-${tenantId}`,
      provider: WEBHOOK_PROVIDERS.CALENDLY,
      label: setup.label,
      status: "connected",
      displayStatus: "connected",
      channelConnected: true,
      webhookUrl: null,
      lastEventAt: null,
      lastError: null,
      eventsSubscribed: WEBHOOK_CAPABILITIES[WEBHOOK_PROVIDERS.CALENDLY],
      canRead: WEBHOOK_CAPABILITIES[WEBHOOK_PROVIDERS.CALENDLY],
      hasSigningSecret: Boolean(process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim()),
      hasVerifyToken: false,
      autoRegisterSupported: setup.autoRegisterSupported,
      manualSetupRequired: setup.manualSetupRequired,
      showWebhookUrl: false,
      showUserSetup: false,
      setupInstructions: setup.setupInstructions,
      docsUrl: null,
      providerWebhookId: calendly.webhookCount > 0 ? "calendly-oauth" : null,
    });
  }

  return serialized.sort((a, b) => a.provider.localeCompare(b.provider));
}
