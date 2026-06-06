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

export function serializeEmailIntegration(record, { dnsRecords } = {}) {
  if (!record) return null;
  const sendingDomain =
    record.sendingDomain || extractDomainFromEmail(record.fromEmail);
  return {
    id: record.id,
    mode: record.mode,
    status: record.status,
    fromEmail: record.fromEmail,
    fromName: record.fromName,
    sendingDomain,
    providerType: record.providerType,
    customTrackingDomain: record.customTrackingDomain,
    isSmtpSuccess: record.isSmtpSuccess,
    isImapSuccess: record.isImapSuccess,
    warmupEnabled: record.warmupEnabled,
    warmupStatus: record.warmupStatus,
    warmupReputation: record.warmupReputation,
    connectedAt: record.connectedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    hasSmartleadAccount: Boolean(record.encryptedSmartleadAccountId),
    dnsRecords:
      dnsRecords ??
      buildDnsRecords({
        sendingDomain,
        trackingHost: record.customTrackingDomain,
      }),
  };
}

export async function getEmailIntegration(tenantId, { refresh = false } = {}) {
  const record = await prisma.emailIntegration.findUnique({
    where: { tenantId },
  });
  if (!record) return null;

  if (refresh && record.encryptedSmartleadAccountId && record.mode === "smartlead_inbox") {
    try {
      const accountId = decryptSmartleadAccountId(record.encryptedSmartleadAccountId);
      const remote = await getEmailAccount(accountId);
      const updated = await prisma.emailIntegration.update({
        where: { tenantId },
        data: mapSmartleadAccountToDb(remote, record),
      });
      return serializeEmailIntegration(updated);
    } catch {
      // Return cached row if Smartlead is unreachable
    }
  }

  return serializeEmailIntegration(record);
}

function mapSmartleadAccountToDb(account, existing) {
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
    customTrackingDomain:
      account?.custom_tracking_domain ??
      account?.custom_tracking_url ??
      existing.customTrackingDomain,
    isSmtpSuccess: smtpOk ?? null,
    isImapSuccess: imapOk ?? null,
    warmupStatus: warmup?.status ?? existing.warmupStatus,
    warmupReputation: warmup?.warmup_reputation ?? existing.warmupReputation,
    status: connected ? "connected" : smtpOk === false || imapOk === false ? "failed" : existing.status,
    connectedAt: connected ? existing.connectedAt ?? new Date() : existing.connectedAt,
  };
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

  const fromEmail = data?.from_email ?? form.fromEmail;
  const sendingDomain = extractDomainFromEmail(fromEmail);
  const smtpOk = data?.is_smtp_success ?? data?.isSmtpSuccess;
  const imapOk = data?.is_imap_success ?? data?.isImapSuccess;
  const warmup = data?.warmup_details;
  const connected = smtpOk !== false && imapOk !== false;

  return prisma.emailIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mode: "smartlead_inbox",
      status: connected ? "connected" : "failed",
      fromEmail,
      fromName: form.fromName,
      sendingDomain,
      providerType: form.providerType,
      encryptedSmartleadAccountId: encryptSmartleadAccountId(accountId),
      customTrackingDomain: form.customTrackingDomain || null,
      isSmtpSuccess: smtpOk ?? null,
      isImapSuccess: imapOk ?? null,
      warmupEnabled: form.warmupEnabled ?? true,
      warmupStatus: warmup?.status ?? null,
      warmupReputation: warmup?.warmup_reputation ?? null,
      connectedAt: connected ? new Date() : null,
    },
    update: {
      mode: "smartlead_inbox",
      status: connected ? "connected" : "failed",
      fromEmail,
      fromName: form.fromName,
      sendingDomain,
      providerType: form.providerType,
      encryptedSmartleadAccountId: encryptSmartleadAccountId(accountId),
      customTrackingDomain: form.customTrackingDomain || null,
      isSmtpSuccess: smtpOk ?? null,
      isImapSuccess: imapOk ?? null,
      warmupEnabled: form.warmupEnabled ?? true,
      warmupStatus: warmup?.status ?? null,
      warmupReputation: warmup?.warmup_reputation ?? null,
      connectedAt: connected ? new Date() : null,
    },
  });
}

export async function getDecryptedSmartleadAccountId(tenantId) {
  const record = await prisma.emailIntegration.findUnique({
    where: { tenantId },
    select: { encryptedSmartleadAccountId: true },
  });
  if (!record?.encryptedSmartleadAccountId) return null;
  return decryptSmartleadAccountId(record.encryptedSmartleadAccountId);
}
