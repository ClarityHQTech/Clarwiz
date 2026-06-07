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

  if (
    tenantIds.size === 0 &&
    ENV_META_VERIFY &&
    provided === ENV_META_VERIFY
  ) {
    const defaultTenant =
      process.env.WHATSAPP_WEBHOOK_DEFAULT_TENANT_ID?.trim() ||
      process.env.WHATSAPP_WEBHOOK_DEFAULT_USER_ID?.trim();
    if (defaultTenant) tenantIds.add(defaultTenant);
  }

  return [...tenantIds];
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
