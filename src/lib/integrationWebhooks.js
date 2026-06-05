import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "@/lib/encryptSecret";
import { getAppBaseUrl } from "@/lib/cronAuth";

export const WEBHOOK_PROVIDERS = {
  SMARTLEAD: "smartlead",
  LINKUP: "linkup",
  WHATSAPP_META: "whatsapp_meta",
  WHATSAPP_INTERAKT: "whatsapp_interakt",
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

export async function bootstrapWebhookSecretsFromEnv(tenantId) {
  const interaktSecret = process.env.INTERAKT_WEBHOOK_SECRET?.trim();
  if (interaktSecret) {
    await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT, {
      signingSecret: interaktSecret,
    });
  }
  const metaVerify =
    process.env.WHATSAPP_META_VERIFY_TOKEN?.trim() ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (metaVerify) {
    await upsertWebhookSecrets(tenantId, WEBHOOK_PROVIDERS.WHATSAPP_META, {
      verifyToken: metaVerify,
    });
  }
}

export async function listWebhooksForTenant(tenantId) {
  const rows = await prisma.integrationWebhook.findMany({
    where: { tenantId },
    orderBy: { provider: "asc" },
  });

  const capabilities = {
    [WEBHOOK_PROVIDERS.SMARTLEAD]: [
      "email_sent",
      "email_open",
      "email_reply",
      "email_bounce",
      "link_click",
      "unsubscribe",
    ],
    [WEBHOOK_PROVIDERS.LINKUP]: ["message_received", "accepted_invitation"],
    [WEBHOOK_PROVIDERS.WHATSAPP_META]: ["delivery", "read", "inbound_reply"],
    [WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT]: [
      "delivery",
      "read",
      "template_status",
      "inbound_reply",
    ],
  };

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    webhookUrl: fullWebhookUrl(row.provider, row.webhookToken),
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    lastError: row.lastError,
    eventsSubscribed: row.eventsSubscribed ?? capabilities[row.provider] ?? [],
    canRead: capabilities[row.provider] ?? [],
    hasSigningSecret: Boolean(row.encryptedSigningSecret),
    hasVerifyToken: Boolean(row.encryptedVerifyToken),
  }));
}
