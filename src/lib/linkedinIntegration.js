import { prisma } from "@/lib/prisma";
import { decryptAccountId, encryptAccountId } from "@/lib/encryptSecret";

export function encryptLinkupAccountId(accountId) {
  return encryptAccountId(accountId);
}

/** Server-side only — use when calling LinkupAPI. */
export function decryptLinkupAccountId(stored) {
  return decryptAccountId(stored);
}

export function serializeLinkedInIntegration(record) {
  if (!record) return null;
  return {
    id: record.id,
    accountName: record.accountName,
    email: record.email,
    status: record.status,
    challengeType: record.challengeType,
    country: record.country,
    connectedAt: record.connectedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    hasAccount: Boolean(record.linkupAccountId),
  };
}

export async function getLinkedInIntegration(userId) {
  const record = await prisma.linkedInIntegration.findUnique({
    where: { userId },
  });
  return serializeLinkedInIntegration(record);
}

/** Load integration with decrypted LinkupAPI account_id for server-side API calls. */
export async function getLinkedInIntegrationWithAccountId(userId) {
  const record = await prisma.linkedInIntegration.findUnique({
    where: { userId },
  });
  if (!record?.linkupAccountId) return null;
  return {
    ...record,
    linkupAccountIdPlain: decryptLinkupAccountId(record.linkupAccountId),
  };
}

export async function upsertLinkedInFromLogin(userId, loginPayload, form) {
  const { data } = loginPayload;
  const status = data?.status ?? "pending";

  const encryptedAccountId = encryptLinkupAccountId(data.account_id);

  return prisma.linkedInIntegration.upsert({
    where: { userId },
    create: {
      userId,
      linkupAccountId: encryptedAccountId,
      accountName: form.accountName || form.email,
      email: form.email,
      status,
      challengeType: data.challenge_type ?? null,
      country: form.country ?? "US",
      connectedAt: status === "connected" ? new Date() : null,
    },
    update: {
      linkupAccountId: encryptedAccountId,
      accountName: form.accountName || form.email,
      email: form.email,
      status,
      challengeType: data.challenge_type ?? null,
      country: form.country ?? "US",
      connectedAt: status === "connected" ? new Date() : null,
    },
  });
}

export async function markLinkedInConnected(userId, accountId) {
  return prisma.linkedInIntegration.update({
    where: { userId },
    data: {
      linkupAccountId: encryptLinkupAccountId(accountId),
      status: "connected",
      challengeType: null,
      connectedAt: new Date(),
    },
  });
}
