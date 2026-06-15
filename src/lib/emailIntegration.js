import { prisma } from "@/lib/prisma";
import {
  decryptSmartleadAccountId,
  encryptSmartleadAccountId,
} from "@/lib/encryptSecret";
import { buildDnsRecords, extractDomainFromEmail } from "@/lib/emailDnsRecords";
import {
  extractSmartleadAccountPayload,
  findEmailAccountByEmail,
  getEmailAccount,
} from "@/lib/smartleadApi";

export const PROVIDER_PRESETS = {
  GMAIL: {
    type: "GMAIL",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    imap_host: "imap.gmail.com",
    imap_port: 993,
  },
  OUTLOOK: {
    type: "OUTLOOK",
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
    imap_host: "outlook.office365.com",
    imap_port: 993,
  },
  SMTP: {
    type: "SMTP",
    smtp_host: "",
    smtp_port: 587,
    imap_host: "",
    imap_port: 993,
  },
};

const emailIntegrationInclude = { inboxes: { orderBy: { createdAt: "asc" } } };

function deriveIntegrationStatus(inboxes = []) {
  if (!inboxes.length) return "not_configured";
  if (inboxes.some((inbox) => inbox.status === "connected")) return "connected";
  if (inboxes.some((inbox) => inbox.status === "failed")) return "failed";
  return "pending";
}

export function serializeSmartleadInbox(inbox) {
  if (!inbox) return null;
  const sendingDomain =
    inbox.sendingDomain || extractDomainFromEmail(inbox.fromEmail);
  return {
    id: inbox.id,
    fromEmail: inbox.fromEmail,
    fromName: inbox.fromName,
    sendingDomain,
    providerType: inbox.providerType,
    isSmtpSuccess: inbox.isSmtpSuccess,
    isImapSuccess: inbox.isImapSuccess,
    warmupEnabled: inbox.warmupEnabled,
    warmupStatus: inbox.warmupStatus,
    warmupReputation: inbox.warmupReputation,
    status: inbox.status,
    connectedAt: inbox.connectedAt?.toISOString() ?? null,
    updatedAt: inbox.updatedAt.toISOString(),
    hasSmartleadAccount: Boolean(inbox.encryptedSmartleadAccountId),
  };
}

export function serializeEmailIntegration(record, { dnsRecords } = {}) {
  if (!record) return null;

  const inboxes = (record.inboxes ?? []).map((inbox) =>
    serializeSmartleadInbox(inbox)
  );
  const primaryInbox =
    inboxes.find((inbox) => inbox.status === "connected") ?? inboxes[0] ?? null;
  const sendingDomain =
    primaryInbox?.sendingDomain ||
    record.sendingDomain ||
    extractDomainFromEmail(record.fromEmail);
  const status = deriveIntegrationStatus(record.inboxes ?? []);

  return {
    id: record.id,
    mode: record.mode,
    status,
    fromEmail: primaryInbox?.fromEmail ?? record.fromEmail,
    fromName: primaryInbox?.fromName ?? record.fromName,
    sendingDomain,
    providerType: primaryInbox?.providerType ?? record.providerType,
    customTrackingDomain: record.customTrackingDomain,
    isSmtpSuccess: primaryInbox?.isSmtpSuccess ?? record.isSmtpSuccess,
    isImapSuccess: primaryInbox?.isImapSuccess ?? record.isImapSuccess,
    warmupEnabled: primaryInbox?.warmupEnabled ?? record.warmupEnabled,
    warmupStatus: primaryInbox?.warmupStatus ?? record.warmupStatus,
    warmupReputation:
      primaryInbox?.warmupReputation ?? record.warmupReputation,
    connectedAt: primaryInbox?.connectedAt ?? record.connectedAt?.toISOString?.() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    hasSmartleadAccount: inboxes.some((inbox) => inbox.hasSmartleadAccount),
    inboxCount: inboxes.length,
    inboxes,
    dnsRecords:
      dnsRecords ??
      buildDnsRecords({
        sendingDomain,
        trackingHost: record.customTrackingDomain,
      }),
  };
}

async function loadEmailIntegrationRecord(tenantId) {
  return prisma.emailIntegration.findUnique({
    where: { tenantId },
    include: emailIntegrationInclude,
  });
}

export async function getEmailIntegration(tenantId, { refresh = false } = {}) {
  let record = await loadEmailIntegrationRecord(tenantId);
  if (!record) return null;

  if (refresh && record.mode === "smartlead_inbox" && record.inboxes.length) {
    try {
      const refreshedInboxes = await Promise.all(
        record.inboxes.map(async (inbox) => {
          if (!inbox.encryptedSmartleadAccountId) return inbox;
          const accountId = decryptSmartleadAccountId(
            inbox.encryptedSmartleadAccountId
          );
          const remote = await getEmailAccount(accountId);
          return prisma.smartleadInbox.update({
            where: { id: inbox.id },
            data: mapSmartleadAccountToInboxDb(remote, inbox),
          });
        })
      );

      const connectedCount = refreshedInboxes.filter(
        (inbox) => inbox.status === "connected"
      ).length;

      record = await prisma.emailIntegration.update({
        where: { tenantId },
        data: {
          status:
            connectedCount > 0
              ? "connected"
              : refreshedInboxes.some((inbox) => inbox.status === "failed")
                ? "failed"
                : record.status,
        },
        include: emailIntegrationInclude,
      });
    } catch {
      // Return cached row if Smartlead is unreachable
    }
  }

  return serializeEmailIntegration(record);
}

function mapSmartleadAccountToInboxDb(account, existing) {
  const warmup = account?.warmup_details;
  const smtpOk = account?.is_smtp_success ?? account?.isSmtpSuccess;
  const imapOk = account?.is_imap_success ?? account?.isImapSuccess;
  const connected = smtpOk && imapOk;

  return {
    fromEmail: account?.from_email ?? existing.fromEmail,
    fromName: account?.from_name ?? existing.fromName,
    sendingDomain:
      extractDomainFromEmail(account?.from_email) ?? existing.sendingDomain,
    providerType: account?.type ?? existing.providerType,
    isSmtpSuccess: smtpOk ?? null,
    isImapSuccess: imapOk ?? null,
    warmupStatus: warmup?.status ?? existing.warmupStatus,
    warmupReputation: warmup?.warmup_reputation ?? existing.warmupReputation,
    status: connected
      ? "connected"
      : smtpOk === false || imapOk === false
        ? "failed"
        : existing.status,
    connectedAt: connected ? existing.connectedAt ?? new Date() : existing.connectedAt,
  };
}

async function ensureEmailIntegrationParent(tenantId) {
  return prisma.emailIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mode: "smartlead_inbox",
      status: "pending",
    },
    update: {},
    include: emailIntegrationInclude,
  });
}

export async function upsertSmartleadInbox(tenantId, smartleadResponse, form) {
  let data =
    extractSmartleadAccountPayload(smartleadResponse) ??
    smartleadResponse?.data ??
    smartleadResponse?.email_account ??
    smartleadResponse;

  if (!data?.id && form.fromEmail) {
    const found = await findEmailAccountByEmail(form.fromEmail);
    if (found) data = found;
  }

  const accountId = data?.id;
  if (!accountId) {
    throw new Error(
      "Smartlead created the inbox but did not return an account id. Try Refresh on Integrations after confirming it appears in Smartlead."
    );
  }

  const fromEmail = (data?.from_email ?? form.fromEmail)?.trim().toLowerCase();
  const sendingDomain = extractDomainFromEmail(fromEmail);
  const smtpOk = data?.is_smtp_success ?? data?.isSmtpSuccess;
  const imapOk = data?.is_imap_success ?? data?.isImapSuccess;
  const warmup = data?.warmup_details;
  const connected = smtpOk !== false && imapOk !== false;

  const parent = await ensureEmailIntegrationParent(tenantId);

  const inbox = await prisma.smartleadInbox.upsert({
    where: {
      emailIntegrationId_fromEmail: {
        emailIntegrationId: parent.id,
        fromEmail,
      },
    },
    create: {
      emailIntegrationId: parent.id,
      fromEmail,
      fromName: form.fromName,
      sendingDomain,
      providerType: form.providerType,
      encryptedSmartleadAccountId: encryptSmartleadAccountId(accountId),
      isSmtpSuccess: smtpOk ?? null,
      isImapSuccess: imapOk ?? null,
      warmupEnabled: form.warmupEnabled ?? true,
      warmupStatus: warmup?.status ?? null,
      warmupReputation: warmup?.warmup_reputation ?? null,
      status: connected ? "connected" : "failed",
      connectedAt: connected ? new Date() : null,
    },
    update: {
      fromName: form.fromName,
      sendingDomain,
      providerType: form.providerType,
      encryptedSmartleadAccountId: encryptSmartleadAccountId(accountId),
      isSmtpSuccess: smtpOk ?? null,
      isImapSuccess: imapOk ?? null,
      warmupEnabled: form.warmupEnabled ?? true,
      warmupStatus: warmup?.status ?? null,
      warmupReputation: warmup?.warmup_reputation ?? null,
      status: connected ? "connected" : "failed",
      connectedAt: connected ? new Date() : null,
    },
  });

  const allInboxes = await prisma.smartleadInbox.findMany({
    where: { emailIntegrationId: parent.id },
    orderBy: { createdAt: "asc" },
  });
  const primaryInbox =
    allInboxes.find((item) => item.status === "connected") ?? inbox;

  const record = await prisma.emailIntegration.update({
    where: { id: parent.id },
    data: {
      mode: "smartlead_inbox",
      status: deriveIntegrationStatus(allInboxes),
      fromEmail: primaryInbox.fromEmail,
      fromName: primaryInbox.fromName,
      sendingDomain: primaryInbox.sendingDomain,
      providerType: primaryInbox.providerType,
      encryptedSmartleadAccountId: primaryInbox.encryptedSmartleadAccountId,
      isSmtpSuccess: primaryInbox.isSmtpSuccess,
      isImapSuccess: primaryInbox.isImapSuccess,
      warmupEnabled: primaryInbox.warmupEnabled,
      warmupStatus: primaryInbox.warmupStatus,
      warmupReputation: primaryInbox.warmupReputation,
      connectedAt: primaryInbox.connectedAt,
      customTrackingDomain:
        form.customTrackingDomain || parent.customTrackingDomain,
    },
    include: emailIntegrationInclude,
  });

  return record;
}

export async function getConnectedSmartleadInboxes(tenantId) {
  const record = await loadEmailIntegrationRecord(tenantId);
  if (!record) return [];
  return record.inboxes.filter(
    (inbox) =>
      inbox.status === "connected" && Boolean(inbox.encryptedSmartleadAccountId)
  );
}

export async function getDecryptedSmartleadAccountIds(tenantId, inboxIds = []) {
  const inboxes = await getConnectedSmartleadInboxes(tenantId);
  if (!inboxes.length) return [];

  const selected = Array.isArray(inboxIds) ? inboxIds.filter(Boolean) : [];
  const filtered =
    selected.length > 0
      ? inboxes.filter((inbox) => selected.includes(inbox.id))
      : inboxes;

  return filtered.map((inbox) =>
    Number(decryptSmartleadAccountId(inbox.encryptedSmartleadAccountId))
  );
}

/** @deprecated Use getDecryptedSmartleadAccountIds — returns first connected inbox id. */
export async function getDecryptedSmartleadAccountId(tenantId) {
  const ids = await getDecryptedSmartleadAccountIds(tenantId);
  return ids[0] ?? null;
}

export async function resolveCampaignSmartleadAccountIds(campaign, tenantId) {
  const accountIds = await getDecryptedSmartleadAccountIds(
    tenantId,
    campaign.smartleadInboxIds
  );
  if (!accountIds.length) {
    throw new Error(
      "Connect at least one Smartlead inbox in Integrations before sending email outreach."
    );
  }
  return accountIds;
}

export async function getSmartleadInboxForTenant(tenantId, inboxId) {
  const record = await loadEmailIntegrationRecord(tenantId);
  if (!record) return null;
  return record.inboxes.find((inbox) => inbox.id === inboxId) ?? null;
}
