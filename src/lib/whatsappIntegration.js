import { prisma } from "@/lib/prisma";
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
} from "@/lib/encryptSecret";
import {
  listInteraktTemplates,
  normalizeInteraktTemplates,
  validateInteraktConnection,
} from "@/lib/interaktApi";
import {
  listMessageTemplates,
  normalizeMetaTemplates,
  validateMetaConnection,
} from "@/lib/metaWhatsAppApi";

export function serializeWhatsAppIntegration(record) {
  if (!record) return null;

  const templates = Array.isArray(record.templatesCache)
    ? record.templatesCache
    : record.templatesCache?.templates ?? [];

  return {
    id: record.id,
    mode: record.mode,
    status: record.status,
    phoneNumberId: record.phoneNumberId,
    wabaId: record.wabaId,
    businessPhone: record.businessPhone,
    businessName: record.businessName,
    hasMetaTokenForTemplates: Boolean(record.encryptedMetaToken),
    templateCount: templates.length,
    templates,
    templatesCachedAt: record.templatesCachedAt?.toISOString() ?? null,
    connectedAt: record.connectedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getWhatsAppIntegration(tenantId, { refresh = false } = {}) {
  const record = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
  });
  if (!record) return null;

  if (refresh) {
    try {
      const updated = await refreshTemplatesCache(record);
      return serializeWhatsAppIntegration(updated);
    } catch {
      // Return cached row if refresh fails
    }
  }

  return serializeWhatsAppIntegration(record);
}

export async function getDecryptedAccessToken(tenantId) {
  const record = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { encryptedAccessToken: true },
  });
  if (!record?.encryptedAccessToken) return null;
  return decryptWhatsAppToken(record.encryptedAccessToken);
}

export async function refreshTemplatesCache(record) {
  let templates = [];

  if (record.mode === "meta") {
    const accessToken = decryptWhatsAppToken(record.encryptedAccessToken);
    const raw = await listMessageTemplates(record.wabaId, accessToken);
    templates = normalizeMetaTemplates(raw);
  } else if (record.mode === "interakt") {
    const apiKey = decryptWhatsAppToken(record.encryptedAccessToken);
    try {
      const raw = await listInteraktTemplates(apiKey);
      templates = normalizeInteraktTemplates(raw);
    } catch (interaktErr) {
      if (record.encryptedMetaToken && record.wabaId) {
        const metaToken = decryptWhatsAppToken(record.encryptedMetaToken);
        const raw = await listMessageTemplates(record.wabaId, metaToken);
        templates = normalizeMetaTemplates(raw);
      } else {
        throw interaktErr;
      }
    }
  }

  return prisma.whatsAppIntegration.update({
    where: { id: record.id },
    data: {
      templatesCache: templates,
      templatesCachedAt: new Date(),
      status: "connected",
    },
  });
}

export async function connectMetaWhatsApp(tenantId, { accessToken, phoneNumberId, wabaId }) {
  const meta = await validateMetaConnection({ accessToken, phoneNumberId, wabaId });

  const record = await prisma.whatsAppIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mode: "meta",
      status: "connected",
      encryptedAccessToken: encryptWhatsAppToken(accessToken),
      phoneNumberId,
      wabaId,
      businessPhone: meta.businessPhone,
      businessName: meta.businessName,
      encryptedMetaToken: null,
      connectedAt: new Date(),
    },
    update: {
      mode: "meta",
      status: "connected",
      encryptedAccessToken: encryptWhatsAppToken(accessToken),
      phoneNumberId,
      wabaId,
      businessPhone: meta.businessPhone,
      businessName: meta.businessName,
      encryptedMetaToken: null,
      connectedAt: new Date(),
    },
  });

  return refreshTemplatesCache(record);
}

export async function connectInteraktWhatsApp(
  tenantId,
  { apiKey, wabaId, metaAccessToken }
) {
  await validateInteraktConnection(apiKey);

  const record = await prisma.whatsAppIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mode: "interakt",
      status: "pending",
      encryptedAccessToken: encryptWhatsAppToken(apiKey),
      wabaId: wabaId || null,
      encryptedMetaToken: metaAccessToken
        ? encryptWhatsAppToken(metaAccessToken)
        : null,
      phoneNumberId: null,
      connectedAt: new Date(),
    },
    update: {
      mode: "interakt",
      status: "pending",
      encryptedAccessToken: encryptWhatsAppToken(apiKey),
      wabaId: wabaId || null,
      encryptedMetaToken: metaAccessToken
        ? encryptWhatsAppToken(metaAccessToken)
        : null,
      phoneNumberId: null,
      connectedAt: new Date(),
    },
  });

  try {
    return await refreshTemplatesCache(record);
  } catch (err) {
    await prisma.whatsAppIntegration.update({
      where: { id: record.id },
      data: { status: "connected" },
    });
    const updated = await prisma.whatsAppIntegration.findUnique({
      where: { id: record.id },
    });
    err.templatesWarning =
      "Connected to Interakt, but templates could not be synced. Add Meta WABA ID + token for template sync, or refresh after templates are synced in Interakt.";
    throw Object.assign(err, { integration: updated });
  }
}
