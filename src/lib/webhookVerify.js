import { prisma } from "@/lib/prisma";
import { getDecryptedVerifyToken } from "@/lib/integrationWebhooks";
import { WEBHOOK_PROVIDERS } from "@/lib/integrationWebhooks";

const ENV_META_VERIFY =
  process.env.WHATSAPP_META_VERIFY_TOKEN?.trim() ||
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

export async function verifyMetaWebhookToken(provided) {
  if (!provided) return false;
  if (ENV_META_VERIFY && provided === ENV_META_VERIFY) return true;

  const rows = await prisma.integrationWebhook.findMany({
    where: { provider: WEBHOOK_PROVIDERS.WHATSAPP_META },
  });
  for (const row of rows) {
    const token = getDecryptedVerifyToken(row);
    if (token && token === provided) return true;
  }
  return false;
}

/** Resolve tenant(s) whose saved Meta verify token matches the Meta GET challenge. */
export async function findMetaWebhookTenantsByVerifyToken(provided) {
  if (!provided) return [];

  const tenantIds = new Set();
  const rows = await prisma.integrationWebhook.findMany({
    where: { provider: WEBHOOK_PROVIDERS.WHATSAPP_META },
    select: { tenantId: true, encryptedVerifyToken: true },
  });

  for (const row of rows) {
    const token = getDecryptedVerifyToken(row);
    if (token && token === provided) tenantIds.add(row.tenantId);
  }

  if (tenantIds.size > 0) return [...tenantIds];

  // Env fallback: Vercel may use WHATSAPP_META_VERIFY_TOKEN while Clarwiz DB still
  // has an older token (or none). Resolve the tenant from connected Meta WhatsApp rows.
  if (!ENV_META_VERIFY || provided !== ENV_META_VERIFY) return [];

  const defaultTenant =
    process.env.WHATSAPP_WEBHOOK_DEFAULT_TENANT_ID?.trim() ||
    process.env.WHATSAPP_WEBHOOK_DEFAULT_USER_ID?.trim();
  if (defaultTenant) return [defaultTenant];

  const connectedMeta = await prisma.whatsAppIntegration.findMany({
    where: { mode: "meta", status: "connected" },
    select: { tenantId: true },
  });

  if (connectedMeta.length === 1) {
    return [connectedMeta[0].tenantId];
  }

  if (connectedMeta.length > 1) {
    const connectedIds = new Set(connectedMeta.map((row) => row.tenantId));
    for (const row of rows) {
      if (!connectedIds.has(row.tenantId)) continue;
      const stored = getDecryptedVerifyToken(row);
      if (!stored || stored === provided) tenantIds.add(row.tenantId);
    }
    if (tenantIds.size > 0) return [...tenantIds];
  }

  return [];
}

export async function verifyInteraktWebhookSecret(provided) {
  if (!provided) return false;
  const envSecret = process.env.INTERAKT_WEBHOOK_SECRET?.trim();
  if (envSecret && provided === envSecret) return true;

  const rows = await prisma.integrationWebhook.findMany({
    where: { provider: WEBHOOK_PROVIDERS.WHATSAPP_INTERAKT },
  });
  for (const row of rows) {
    const { getDecryptedSigningSecret } = await import("@/lib/integrationWebhooks");
    const secret = getDecryptedSigningSecret(row);
    if (secret && secret === provided) return true;
  }
  return false;
}
