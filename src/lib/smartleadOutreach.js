import { prisma } from "@/lib/prisma";
import { syncCampaignContactStatus } from "@/lib/syncCampaignContactStatus";
import {
  getDecryptedSmartleadAccountId,
  getEmailIntegration,
} from "@/lib/emailIntegration";
import {
  buildProspectSmartleadSchedule,
  resolveDeliveryTimeLocal,
  resolveTimezone,
} from "@/lib/execution/outreachSchedule";
import {
  addCampaignLeads,
  createCampaign,
  extractReplyBodyFromInboxRow,
  findCampaignLeadRow,
  findInboxRowByEmail,
  findSentMessageForLeadEmail,
  getCampaign,
  normalizeInboxRows,
  getLeadEmailFromInboxRow,
  getCampaignAnalytics,
  getCampaignLeads,
  getInboxReplies,
  getInboxSent,
  leadIdFromAddLeadsResult,
  leadRowSendState,
  linkCampaignEmailAccounts,
  replyEmailThread,
  updateCampaignLead,
  wasLeadAddedToCampaign,
  setCampaignSchedule,
  setCampaignSequences,
  setCampaignStatus,
  updateCampaignSettings,
} from "@/lib/smartleadApi";

const CLARWIZ_SEQUENCE = [
  {
    seq_number: 1,
    subject: "{{outreach_subject}}",
    email_body: "{{outreach_body}}",
    seq_delay_details: { delay_in_days: 0 },
  },
];

/** Smartlead day codes: 0 = Sun … 6 = Sat (max value is 6, not 7). */
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Wide-open schedule so test sends are not held for the next window. */
export function buildImmediateTestSchedule() {
  return {
    timezone: process.env.SMARTLEAD_SCHEDULE_TZ?.trim() || "UTC",
    days_of_the_week: ALL_WEEK_DAYS,
    start_hour: "00:00",
    end_hour: "23:59",
    min_time_btw_emails: 3,
    max_new_leads_per_day: 1000,
  };
}

export async function applyImmediateTestSchedule(smartleadCampaignId) {
  return setCampaignSchedule(smartleadCampaignId, buildImmediateTestSchedule());
}

const SMARTLEAD_WAIT_MS = Number(process.env.SMARTLEAD_WAIT_FOR_SEND_MS) || 45_000;
const SMARTLEAD_POLL_MS = 5_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function smartleadCampaignUrl(smartleadCampaignId) {
  if (!smartleadCampaignId) return null;
  return `https://app.smartlead.ai/app/email-campaign/${smartleadCampaignId}/analytics`;
}

/**
 * One shared sequence for the whole campaign — per-lead copy lives in custom_fields
 * (outreach_subject, outreach_body). Never overwrite this with one prospect's literal
 * text or every queued lead receives the last person's message.
 */
async function ensureCampaignSequenceTemplate(smartleadCampaignId) {
  await setCampaignSequences(smartleadCampaignId, CLARWIZ_SEQUENCE);
}

function splitName(name) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "", last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function extractCampaignId(result) {
  return result?.id ?? result?.campaign?.id ?? result?.campaign_id ?? null;
}

function normalizeEmailStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function mapEngagementFromSmartlead(message, { engagementHint } = {}) {
  if (!message) return { activity: null };

  const status = normalizeEmailStatus(
    message.email_status ??
      message.emailStatus ??
      message.lead_status ??
      (Array.isArray(engagementHint) ? engagementHint[0] : engagementHint)
  );
  const last = message.last_message ?? {};
  const stats = message.stats ?? {};
  const lastReplyTime = last.replied_at ?? last.received_at ?? message.last_reply_time;
  const lastOpenTime = last.opened_at ?? message.last_open_time ?? message.last_sent_time;
  const replyCount = stats.replies ?? stats.total_replied ?? 0;
  const openCount = stats.opens ?? stats.total_opened ?? 0;
  const clickCount = stats.clicks ?? stats.total_clicked ?? 0;

  const isReply =
    status === "Replied" ||
    replyCount > 0 ||
    Boolean(lastReplyTime) ||
    message.has_new_unread_email === true;

  if (isReply) {
    const replyBody = extractReplyBodyFromInboxRow(message);
    return {
      activity: "reply",
      emailStatus: status || "Replied",
      openedAt: lastOpenTime ?? null,
      repliedAt: lastReplyTime ?? null,
      responseContent:
        replyBody ??
        (lastReplyTime ? "Prospect replied via email (Smartlead)" : null),
      deliveryMeta: buildDeliveryMeta(message),
    };
  }

  const isOpen =
    status === "Opened" ||
    status === "Clicked" ||
    engagementHint === "Opened" ||
    engagementHint === "Clicked" ||
    (Array.isArray(engagementHint) &&
      engagementHint.some((h) => h === "Opened" || h === "Clicked")) ||
    openCount > 0 ||
    clickCount > 0 ||
    Boolean(last.opened_at);

  if (isOpen) {
    return {
      activity: "open",
      emailStatus: status || (engagementHint === "Clicked" ? "Clicked" : "Opened"),
      openedAt: lastOpenTime ?? null,
      deliveryMeta: buildDeliveryMeta(message),
    };
  }

  return {
    activity: null,
    emailStatus: status || message.lead_status || null,
    deliveryMeta: buildDeliveryMeta(message),
  };
}

export function buildDeliveryMeta(message) {
  if (!message) return null;
  const last = message.last_message ?? {};
  const history = message.email_history ?? message.message_history ?? [];
  const latestReply = Array.isArray(history)
    ? [...history]
        .reverse()
        .find(
          (e) =>
            String(e.type ?? e.direction ?? "").toUpperCase() === "REPLY" ||
            String(e.direction ?? "").toLowerCase() === "inbound"
        )
    : null;
  return {
    smartleadMessageId: message.id ?? message.email_lead_id ?? null,
    campaignLeadMapId:
      message.campaign_lead_map_id ??
      message.email_lead_map_id ??
      null,
    emailStatsId:
      latestReply?.stats_id ??
      last.email_stats_id ??
      last.stats_id ??
      message.email_stats_id ??
      message.stats_id ??
      message.email_lead_map_id ??
      null,
    smartleadCampaignId:
      message.campaign?.id ?? message.email_campaign_id ?? null,
    emailStatus: message.email_status ?? message.lead_status ?? null,
    lastActivity:
      message.stats?.last_activity ??
      last.sent_at ??
      message.last_sent_time ??
      null,
    leadEmail: getLeadEmailFromInboxRow(message) || null,
  };
}

export async function requireConnectedEmailIntegration(tenantId) {
  const integration = await getEmailIntegration(tenantId);
  if (
    !integration ||
    integration.mode !== "smartlead_inbox" ||
    integration.status !== "connected" ||
    !integration.hasSmartleadAccount
  ) {
    throw new Error(
      "Connect a Smartlead inbox in Integrations before sending email outreach."
    );
  }
  const emailAccountId = await getDecryptedSmartleadAccountId(tenantId);
  if (!emailAccountId) {
    throw new Error("Smartlead email account is missing — reconnect in Integrations.");
  }
  return { integration, emailAccountId: Number(emailAccountId) };
}

async function verifySmartleadCampaignExists(smartleadCampaignId) {
  try {
    const remote = await getCampaign(smartleadCampaignId);
    return Boolean(remote?.id ?? remote?.campaign?.id);
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

export async function ensureSmartleadCampaignForClarwiz(campaign) {
  const { emailAccountId } = await requireConnectedEmailIntegration(
    campaign.tenantId
  );

  let smartleadCampaignId = campaign.smartleadCampaignId
    ? Number(campaign.smartleadCampaignId)
    : null;

  if (smartleadCampaignId) {
    const exists = await verifySmartleadCampaignExists(smartleadCampaignId);
    if (!exists) {
      smartleadCampaignId = null;
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { smartleadCampaignId: null },
      });
      campaign.smartleadCampaignId = null;
    }
  }

  if (smartleadCampaignId) {
    return smartleadCampaignId;
  }

  const created = await createCampaign({
    name: `Clarwiz — ${campaign.name}`.slice(0, 120),
  });
  smartleadCampaignId = Number(extractCampaignId(created));
  if (!smartleadCampaignId) {
    throw new Error("Smartlead did not return a campaign id");
  }

  await linkCampaignEmailAccounts(smartleadCampaignId, [emailAccountId]);
  await applyImmediateTestSchedule(smartleadCampaignId);
  await ensureCampaignSequenceTemplate(smartleadCampaignId);
  await updateCampaignSettings(smartleadCampaignId, {
    track_settings: [],
  });
  await setCampaignStatus(smartleadCampaignId, "START");

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { smartleadCampaignId },
  });

  campaign.smartleadCampaignId = smartleadCampaignId;
  return smartleadCampaignId;
}

export async function resolveSmartleadDeliveryStatus({
  smartleadCampaignId,
  leadEmail,
  emailAccountId,
  waitMs = 0,
}) {
  const deadline = Date.now() + waitMs;
  let lastRow = null;
  let lastAnalytics = null;

  do {
    const [leadsRes, analytics, inboxRow] = await Promise.all([
      getCampaignLeads(smartleadCampaignId, { limit: 100 }),
      getCampaignAnalytics(smartleadCampaignId).catch(() => null),
      findSentMessageForLeadEmail({
        leadEmail,
        emailAccountId,
        smartleadCampaignId,
      }).catch(() => null),
    ]);

    lastAnalytics = analytics;
    lastRow = findCampaignLeadRow(leadsRes, leadEmail);
    const rowState = leadRowSendState(lastRow);

    if (inboxRow) {
      return {
        status: "sent",
        leadState: rowState,
        leadRow: lastRow,
        inboxRow,
        deliveryMeta: {
          ...buildDeliveryMeta(inboxRow),
          smartleadCampaignId,
          leadStatus: lastRow?.status ?? null,
          campaignSentCount: analytics?.sent_count ?? null,
        },
        message: "Email appears in Smartlead sent mail.",
      };
    }

    if (rowState === "sent") {
      return {
        status: "sent",
        leadState: rowState,
        leadRow: lastRow,
        inboxRow: null,
        deliveryMeta: {
          smartleadCampaignId,
          campaignLeadMapId: lastRow?.campaign_lead_map_id ?? null,
          smartleadLeadId: lastRow?.lead?.id ?? null,
          leadStatus: lastRow?.status ?? null,
          campaignSentCount: analytics?.sent_count ?? null,
        },
        message: `Lead marked ${lastRow?.status ?? "sent"} in Smartlead campaign.`,
      };
    }

    if (rowState === "failed") {
      return {
        status: "failed",
        leadState: rowState,
        leadRow: lastRow,
        deliveryMeta: {
          smartleadCampaignId,
          leadStatus: lastRow?.status ?? null,
        },
        message: `Lead blocked or failed in Smartlead (${lastRow?.status}).`,
      };
    }

    if (waitMs <= 0 || Date.now() >= deadline) break;
    await sleep(Math.min(SMARTLEAD_POLL_MS, deadline - Date.now()));
  } while (Date.now() < deadline);

  if (!lastRow) {
    return {
      status: "failed",
      leadState: "not_found",
      leadRow: null,
      deliveryMeta: {
        smartleadCampaignId,
        campaignSentCount: lastAnalytics?.sent_count ?? null,
      },
      message:
        "Lead was not added to this Smartlead campaign (often because the contact already exists in another campaign). Re-run execution after the fix or add the lead manually in Smartlead.",
    };
  }

  return {
    status: "queued",
    leadState: leadRowSendState(lastRow),
    leadRow: lastRow,
    deliveryMeta: {
      smartleadCampaignId,
      campaignLeadMapId: lastRow?.campaign_lead_map_id ?? null,
      smartleadLeadId: lastRow?.lead?.id ?? null,
      leadStatus: lastRow?.status ?? null,
      campaignSentCount: lastAnalytics?.sent_count ?? null,
    },
    message:
      "Lead queued in Smartlead — sends run on their schedule (~3 min between emails). Check the campaign in Smartlead or use Check email status.",
  };
}

function priorEmailStatsId(commHistory) {
  for (let i = commHistory.length - 1; i >= 0; i -= 1) {
    const log = commHistory[i];
    if (log.channel !== "email") continue;
    const id = log.deliveryMeta?.emailStatsId;
    if (id) return id;
  }
  return null;
}

export async function sendPlannedEmailViaSmartlead({
  campaign,
  prospect,
  subject,
  message,
  commHistory = [],
  useProspectSchedule = false,
}) {
  const { emailAccountId } = await requireConnectedEmailIntegration(
    campaign.tenantId
  );

  if (!prospect.email?.trim()) {
    throw new Error(`Prospect ${prospect.name} has no email address`);
  }

  const smartleadCampaignId = await ensureSmartleadCampaignForClarwiz(campaign);
  const emailStatsId = priorEmailStatsId(commHistory);

  if (emailStatsId) {
    await replyEmailThread(smartleadCampaignId, {
      email_stats_id: String(emailStatsId),
      email_body: message,
      to_email: prospect.email.trim(),
      add_signature: true,
    });
    return {
      deliveryProvider: "smartlead",
      deliveryMeta: {
        smartleadCampaignId,
        emailStatsId,
        sendMode: "reply_thread",
      },
      status: "sent",
    };
  }

  const { first_name, last_name } = splitName(prospect.name);
  const toEmail = prospect.email.trim();

  if (useProspectSchedule) {
    await setCampaignSchedule(
      smartleadCampaignId,
      buildProspectSmartleadSchedule({
        timezone: resolveTimezone(campaign),
        deliveryTime: resolveDeliveryTimeLocal(prospect, campaign),
      })
    );
  } else {
    await applyImmediateTestSchedule(smartleadCampaignId);
  }
  await ensureCampaignSequenceTemplate(smartleadCampaignId);

  const leadPayload = {
    email: toEmail,
    first_name,
    last_name,
    company_name: prospect.company ?? undefined,
    custom_fields: {
      outreach_subject: subject || "Following up",
      outreach_body: message,
      clarwiz_prospect_id: prospect.id,
    },
    ...(prospect.linkedinUrl ? { linkedin_profile: prospect.linkedinUrl } : {}),
  };

  const addResult = await addCampaignLeads(smartleadCampaignId, [leadPayload]);

  if (!wasLeadAddedToCampaign(addResult, toEmail)) {
    const inOther =
      addResult?.emailToLeadIdMap?.existingLeadsInOtherCampaigns?.[toEmail] ??
      addResult?.emailToLeadIdMap?.existingLeadsInOtherCampaigns?.[
        toEmail.toLowerCase()
      ];
    const reason = inOther
      ? `Lead ${toEmail} exists in another Smartlead campaign and was not imported into campaign ${smartleadCampaignId}.`
      : `Smartlead did not add ${toEmail} to campaign ${smartleadCampaignId} (upload_count=${addResult?.upload_count ?? 0}, total_leads=${addResult?.total_leads ?? 0}).`;
    throw new Error(reason);
  }

  const leadIdFromMap = leadIdFromAddLeadsResult(addResult, toEmail);
  const existingLeadId =
    addResult?.emailToLeadIdMap?.existingLeads?.[toEmail] ??
    addResult?.emailToLeadIdMap?.existingLeads?.[toEmail.toLowerCase()];

  if (existingLeadId) {
    await updateCampaignLead(smartleadCampaignId, existingLeadId, leadPayload);
  }

  await setCampaignStatus(smartleadCampaignId, "START");

  const resolved = await resolveSmartleadDeliveryStatus({
    smartleadCampaignId,
    leadEmail: toEmail,
    emailAccountId,
    waitMs: SMARTLEAD_WAIT_MS,
  });

  const deliveryMeta = {
    smartleadCampaignId,
    emailAccountId,
    sendMode: "campaign_lead",
    smartleadLeadId: leadIdFromMap,
    smartleadCampaignUrl: smartleadCampaignUrl(smartleadCampaignId),
    ...resolved.deliveryMeta,
    deliveryMessage: resolved.message,
  };

  return {
    deliveryProvider: "smartlead",
    deliveryMeta,
    status: resolved.status,
    deliveryMessage: resolved.message,
  };
}

async function querySentEngagement({
  prospectEmail,
  emailAccountId,
  smartleadCampaignId,
  emailStatus,
  engagementHint,
  fetchMessageHistory = false,
}) {
  const data = await getInboxSent(
    {
      offset: 0,
      limit: 20,
      filters: {
        search: prospectEmail?.trim().slice(0, 30),
        ...(emailAccountId != null
          ? { emailAccountId: Number(emailAccountId) }
          : {}),
        ...(smartleadCampaignId != null
          ? { campaignId: Number(smartleadCampaignId) }
          : {}),
        ...(emailStatus != null ? { emailStatus } : {}),
      },
      sortBy: "SENT_TIME_DESC",
    },
    { fetchMessageHistory }
  );

  const message = findInboxRowByEmail(normalizeInboxRows(data), prospectEmail);
  if (!message) return null;

  const engagement = mapEngagementFromSmartlead(message, { engagementHint });
  if (!engagement.activity) return null;

  return { message, engagement, source: "sent" };
}

export async function fetchSmartleadEngagementForProspect({
  tenantId,
  prospectEmail,
  smartleadCampaignId,
}) {
  const { emailAccountId } = await requireConnectedEmailIntegration(tenantId);
  const search = prospectEmail?.trim().slice(0, 30);
  if (!search) return null;

  // Replies — inbox-replies includes email_history with reply bodies (sent rows do not)
  const replies = await getInboxReplies(
    {
      offset: 0,
      limit: 20,
      filters: {
        search,
        ...(emailAccountId != null
          ? { emailAccountId: Number(emailAccountId) }
          : {}),
        ...(smartleadCampaignId != null
          ? { campaignId: Number(smartleadCampaignId) }
          : {}),
        emailStatus: "Replied",
      },
      sortBy: "REPLY_TIME_DESC",
    },
    { fetchMessageHistory: true }
  );

  const replyMessage = findInboxRowByEmail(
    normalizeInboxRows(replies),
    prospectEmail
  );
  if (replyMessage) {
    const engagement = mapEngagementFromSmartlead(replyMessage, {
      engagementHint: "Replied",
    });
    if (engagement.activity) {
      return { message: replyMessage, engagement, source: "inbox" };
    }
  }

  const replyFromSent = await querySentEngagement({
    prospectEmail,
    emailAccountId,
    smartleadCampaignId,
    emailStatus: "Replied",
    engagementHint: "Replied",
    fetchMessageHistory: true,
  });
  if (replyFromSent) return replyFromSent;

  // Opens / clicks — must query sent mailbox with emailStatus (not on default row shape)
  const openFromSent = await querySentEngagement({
    prospectEmail,
    emailAccountId,
    smartleadCampaignId,
    emailStatus: ["Opened", "Clicked"],
    engagementHint: "Opened",
    fetchMessageHistory: false,
  });
  if (openFromSent) return openFromSent;

  // Fallback: row may include last_reply_time without Replied filter
  let message = await findSentMessageForLeadEmail({
    leadEmail: prospectEmail,
    emailAccountId,
    smartleadCampaignId,
  });

  let engagement = mapEngagementFromSmartlead(message);
  if (engagement.activity) {
    return { message, engagement, source: "sent" };
  }

  return { message, engagement, source: "sent" };
}

export async function applyEngagementToCommLog(log, engagement) {
  if (!engagement?.activity) return { updated: false, log };

  const data = {
    deliveryProvider: log.deliveryProvider ?? "smartlead",
    deliveryMeta: {
      ...(log.deliveryMeta && typeof log.deliveryMeta === "object"
        ? log.deliveryMeta
        : {}),
      ...(engagement.deliveryMeta ?? {}),
      emailStatus: engagement.emailStatus,
    },
  };

  if (engagement.activity === "open" && !log.openedAt) {
    data.openedAt = engagement.openedAt
      ? new Date(engagement.openedAt)
      : new Date();
    data.status = log.status === "planned" ? "delivered" : log.status;
  }

  if (engagement.activity === "reply" && !log.responseType) {
    data.responseType = "reply";
    data.responseAt = engagement.repliedAt
      ? new Date(engagement.repliedAt)
      : new Date();
    data.responseContent =
      engagement.responseContent?.trim() ||
      "Prospect replied via email (Smartlead)";
    if (!log.openedAt) {
      data.openedAt = engagement.openedAt
        ? new Date(engagement.openedAt)
        : new Date();
    }
    data.status = "delivered";
  }

  const updated = await prisma.communicationLog.update({
    where: { id: log.id },
    data,
  });

  await syncCampaignContactStatus(prisma, updated.campaignContactId);

  return { updated: true, log: updated, activity: engagement.activity };
}
