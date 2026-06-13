/**
 * Load TOFU outreach context for MOFU deals via CampaignContact links.
 * Used by assembleContext so AE Assist gets comm logs, score, persona, and
 * campaign metadata — not just the HubSpot-mirrored contact/company rows.
 */

const COMM_LOG_TAKE = 50;

const campaignContactInclude = {
  campaign: {
    select: {
      id: true,
      name: true,
      description: true,
      goals: true,
      targetSegment: true,
      status: true,
      startDate: true,
      enabledChannels: true,
    },
  },
  contact: {
    select: {
      id: true,
      persona: true,
      lifecycleStage: true,
      hubspotContactId: true,
      businessUser: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          linkedinUrl: true,
        },
      },
    },
  },
  commLogs: {
    orderBy: { sentAt: "asc" },
    take: COMM_LOG_TAKE,
    select: {
      id: true,
      channel: true,
      stage: true,
      subject: true,
      message: true,
      ctaType: true,
      status: true,
      sentAt: true,
      responseType: true,
      responseAt: true,
      responseContent: true,
    },
  },
};

/** Shape one CampaignContact row for prompt / API consumption. */
export function formatCampaignContactContext(cc) {
  if (!cc) return null;
  return {
    id: cc.id,
    status: cc.status,
    score: cc.score,
    scoreBreakdown: cc.scoreBreakdown ?? null,
    scoreUpdatedAt: cc.scoreUpdatedAt ?? null,
    qualifiedAt: cc.qualifiedAt ?? null,
    qualifiedReason: cc.qualifiedReason ?? null,
    hubspotDealId: cc.hubspotDealId ?? null,
    campaign: cc.campaign ?? null,
    contact: cc.contact
      ? {
          id: cc.contact.id,
          persona: cc.contact.persona,
          lifecycleStage: cc.contact.lifecycleStage,
          hubspotContactId: cc.contact.hubspotContactId,
          businessUser: cc.contact.businessUser ?? null,
        }
      : null,
    commLogs: cc.commLogs ?? [],
  };
}

/** Collect unique campaign-contact ids linked to a deal graph row. */
export function collectCampaignContactIds({ deal, account, dealContacts = [] } = {}) {
  const ids = new Set();
  if (deal?.campaignContactId) ids.add(deal.campaignContactId);
  if (account?.campaignContactId) ids.add(account.campaignContactId);
  for (const dc of dealContacts) {
    if (dc?.campaignContactId) ids.add(dc.campaignContactId);
  }
  return [...ids];
}

/** Load formatted TOFU context for a set of campaign contact ids (tenant-scoped). */
export async function loadCampaignContactContexts(prisma, tenantId, campaignContactIds = []) {
  const unique = [...new Set(campaignContactIds.filter(Boolean))];
  if (!unique.length) return [];

  const rows = await prisma.campaignContact.findMany({
    where: { id: { in: unique }, campaign: { tenantId } },
    include: campaignContactInclude,
  });

  return rows.map(formatCampaignContactContext).filter(Boolean);
}

/**
 * Resolve campaign-contact ids for a deal id, load contexts, and return
 * { campaignContactIds, campaignContexts }.
 */
export async function loadCampaignContextForDeal(prisma, tenantId, dealId) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    select: {
      campaignContactId: true,
      account: { select: { campaignContactId: true } },
      dealContacts: { select: { campaignContactId: true } },
    },
  });
  if (!deal) return { campaignContactIds: [], campaignContexts: [] };

  const campaignContactIds = collectCampaignContactIds({
    deal,
    account: deal.account,
    dealContacts: deal.dealContacts,
  });
  const campaignContexts = await loadCampaignContactContexts(prisma, tenantId, campaignContactIds);
  return { campaignContactIds, campaignContexts };
}

/** Flatten comm logs from campaign contexts into engagement-shaped rows (newest first). */
export function campaignContextsToEngagements(campaignContexts = []) {
  const rows = [];
  for (const ctx of campaignContexts) {
    for (const log of ctx.commLogs ?? []) {
      rows.push({
        ...log,
        source: "clarwiz_tofu",
        campaignContactId: ctx.id,
        campaignName: ctx.campaign?.name ?? null,
      });
      if (log.responseType || log.responseAt || log.responseContent) {
        rows.push({
          id: `${log.id}-reply`,
          channel: log.channel,
          subject: log.subject,
          message: log.responseContent,
          status: log.responseType ?? "responded",
          sentAt: log.responseAt ?? log.sentAt,
          source: "clarwiz_tofu",
          direction: "inbound",
          campaignContactId: ctx.id,
          campaignName: ctx.campaign?.name ?? null,
        });
      }
    }
  }
  rows.sort((a, b) => {
    const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return tb - ta;
  });
  return rows;
}

/** Merge persona + TOFU score onto CRM contact rows when a campaign link exists. */
export function enrichContactsWithCampaignContext(contacts = [], campaignContexts = []) {
  if (!contacts.length || !campaignContexts.length) return contacts;

  const byContactId = new Map();
  for (const ctx of campaignContexts) {
    const cid = ctx.contact?.id;
    if (cid && !byContactId.has(cid)) byContactId.set(cid, ctx);
  }

  return contacts.map((c) => {
    const ctx = byContactId.get(c.id);
    if (!ctx) return c;
    return {
      ...c,
      persona: c.persona ?? ctx.contact?.persona ?? null,
      tofuScore: ctx.score,
      tofuStatus: ctx.status,
      tofuQualifiedReason: ctx.qualifiedReason ?? null,
      tofuQualifiedAt: ctx.qualifiedAt ?? null,
      campaignContactId: ctx.id,
      campaignName: ctx.campaign?.name ?? null,
      tofuCommCount: ctx.commLogs?.length ?? 0,
    };
  });
}

/** Load TOFU campaign contexts linked to a tenant account (deal + contact bridge ids). */
export async function loadCampaignContextForAccount(prisma, tenantId, accountId) {
  const [account, deals] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, tenantId },
      select: { campaignContactId: true },
    }),
    prisma.deal.findMany({
      where: { tenantId, accountId },
      select: {
        campaignContactId: true,
        dealContacts: { select: { campaignContactId: true } },
      },
    }),
  ]);

  const ids = new Set();
  if (account?.campaignContactId) ids.add(account.campaignContactId);
  for (const deal of deals) {
    if (deal.campaignContactId) ids.add(deal.campaignContactId);
    for (const dc of deal.dealContacts) {
      if (dc.campaignContactId) ids.add(dc.campaignContactId);
    }
  }

  const campaignContactIds = [...ids];
  const campaignContexts = await loadCampaignContactContexts(prisma, tenantId, campaignContactIds);
  return { campaignContactIds, campaignContexts };
}

/**
 * Load TOFU campaign contexts for a CRM contact — merges explicit bridge ids
 * (from deal/account sync) with any CampaignContact rows for that contact.
 */
export async function loadCampaignContextForContact(
  prisma,
  tenantId,
  contactId,
  { seedIds = [] } = {}
) {
  const ids = new Set(seedIds.filter(Boolean));
  const rows = await prisma.campaignContact.findMany({
    where: { contactId, campaign: { tenantId } },
    select: { id: true },
    orderBy: [{ score: "desc" }, { scoreUpdatedAt: "desc" }],
  });
  for (const row of rows) ids.add(row.id);

  const campaignContactIds = [...ids];
  const campaignContexts = await loadCampaignContactContexts(prisma, tenantId, campaignContactIds);
  return { campaignContactIds, campaignContexts };
}
