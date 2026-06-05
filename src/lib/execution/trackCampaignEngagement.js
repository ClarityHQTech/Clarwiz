/** Engagement tracking rules: docs/execution-layer-rules.md §8 */
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { checkEmailEngagementForProspect } from "@/lib/execution/checkEmailEngagement";
import { checkLinkedInEngagementForCampaign } from "@/lib/execution/checkLinkedInEngagement";
import { checkWhatsAppEngagementForCampaign } from "@/lib/execution/checkWhatsAppEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { runPostTrackQualification } from "@/lib/execution/qualifyProspect";
import { contactCampaignInclude } from "@/lib/campaignDetail";
import { flattenContactCampaign } from "@/lib/resolveBusinessUser";

const PENDING_STATUSES = ["planned", "queued", "sent", "delivered"];

async function loadTrackingContext(campaignId, contactCampaignIds) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      contactCampaigns: {
        include: contactCampaignInclude,
        ...(contactCampaignIds?.length
          ? { where: { id: { in: contactCampaignIds } } }
          : {}),
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!campaign) throw new Error("Campaign not found");

  const pendingLogs = await prisma.communicationLog.findMany({
    where: {
      campaignId,
      responseType: null,
      status: { in: PENDING_STATUSES },
      channel: { in: ["email", "linkedin", "whatsapp"] },
      ...(contactCampaignIds?.length
        ? { contactCampaignId: { in: contactCampaignIds } }
        : {}),
    },
    orderBy: { sentAt: "desc" },
  });

  const linkedInLogs = await prisma.communicationLog.findMany({
    where: {
      campaignId,
      channel: "linkedin",
      ...(contactCampaignIds?.length
        ? { contactCampaignId: { in: contactCampaignIds } }
        : {}),
    },
    select: {
      id: true,
      contactCampaignId: true,
      ctaType: true,
      status: true,
      sentAt: true,
      deliveredAt: true,
      responseType: true,
      deliveryMeta: true,
    },
    orderBy: { sentAt: "desc" },
  });

  const pendingLogsByCc = new Map();
  for (const log of pendingLogs) {
    const list = pendingLogsByCc.get(log.contactCampaignId) ?? [];
    list.push(log);
    pendingLogsByCc.set(log.contactCampaignId, list);
  }

  const linkedInLogsByCc = new Map();
  for (const log of linkedInLogs) {
    const list = linkedInLogsByCc.get(log.contactCampaignId) ?? [];
    list.push(log);
    linkedInLogsByCc.set(log.contactCampaignId, list);
  }

  const prospects = campaign.contactCampaigns.map((cc) => flattenContactCampaign(cc));

  return {
    campaign,
    prospects,
    contactCampaigns: campaign.contactCampaigns,
    pendingLogsByProspect: pendingLogsByCc,
    linkedInLogsByProspect: linkedInLogsByCc,
  };
}

export async function trackCampaignEngagement(
  campaignId,
  { tenantId, prospectIds, contactCampaignIds, mode = "copilot" } = {}
) {
  const ids = contactCampaignIds ?? prospectIds;
  const { campaign, prospects, pendingLogsByProspect, linkedInLogsByProspect } =
    await loadTrackingContext(campaignId, ids);

  if (mode === "autopilot" || campaign.status === "active") {
    return {
      results: [],
      summary: { tracked: 0, updated: 0, reran: 0 },
      message: "Autopilot campaigns use webhooks for tracking",
    };
  }

  if (!prospects.length) {
    return {
      results: [],
      summary: { tracked: 0, updated: 0, reran: 0 },
    };
  }

  const allResults = [];

  const linkedIn = await checkLinkedInEngagementForCampaign({
    tenantId,
    campaignId,
    prospects,
    pendingLogsByProspect,
    linkedInLogsByProspect,
  });
  if (linkedIn.results?.length) allResults.push(...linkedIn.results);

  const whatsapp = await checkWhatsAppEngagementForCampaign({
    tenantId,
    prospects,
    pendingLogsByProspect,
  });
  if (whatsapp.results?.length) allResults.push(...whatsapp.results);

  for (const prospect of prospects) {
    const pending = pendingLogsByProspect.get(prospect.id) ?? [];
    const hasEmailPending = pending.some(
      (l) => l.channel === "email" && !l.responseType
    );
    if (!hasEmailPending || !prospect.email?.trim()) continue;

    try {
      const emailResult = await checkEmailEngagementForProspect({
        campaignId,
        prospectId: prospect.id,
        tenantId,
      });

      if (emailResult.activity) {
        allResults.push({
          prospectId: prospect.id,
          channel: "email",
          activity: emailResult.activity,
          commLogId: emailResult.commLogId,
          ranExecution: emailResult.ranExecution,
        });
      } else if (emailResult.commLogId) {
        allResults.push({
          prospectId: prospect.id,
          channel: "email",
          activity: null,
          commLogId: emailResult.commLogId,
          message: emailResult.message,
        });
      }
    } catch (err) {
      allResults.push({
        prospectId: prospect.id,
        channel: "email",
        activity: null,
        error: err.message,
      });
    }
  }

  const replyProspectIds = new Set();
  for (const r of allResults) {
    if (r.activity === "reply" && !r.ranExecution) {
      replyProspectIds.add(r.prospectId);
    }
  }

  let reran = 0;
  for (const prospectId of replyProspectIds) {
    const alreadyRan = allResults.some(
      (r) => r.prospectId === prospectId && r.ranExecution
    );
    if (alreadyRan) continue;

    await runExecutionForCampaign(campaignId, {
      contactCampaignIds: [prospectId],
      skipDailyLimit: true,
    });
    reran += 1;
    const idx = allResults.findIndex(
      (r) => r.prospectId === prospectId && r.activity === "reply"
    );
    if (idx >= 0) allResults[idx].ranExecution = true;
  }

  const updated = allResults.filter((r) => r.activity).length;

  const qualifyProspectIds = [
    ...new Set([
      ...replyProspectIds,
      ...allResults.filter((r) => r.activity === "reply").map((r) => r.prospectId),
    ]),
  ];
  const qualificationResults =
    qualifyProspectIds.length > 0
      ? await runPostTrackQualification(prisma, campaignId, {
          contactCampaignIds: [...qualifyProspectIds],
        })
      : [];

  if (updated > 0 || qualificationResults.some((q) => q.qualified)) {
    await syncCampaignMetrics(prisma, campaignId);
  }

  return {
    results: allResults,
    qualificationResults,
    summary: {
      tracked: prospects.length,
      updated,
      reran,
      qualified: qualificationResults.filter((q) => q.qualified).length,
      linkedInSkipped: linkedIn.skipped ?? false,
      whatsappSkipped: whatsapp.skipped ?? false,
    },
    channelNotes: {
      linkedIn: linkedIn.reason ?? null,
      whatsapp: whatsapp.reason ?? whatsapp.message ?? null,
    },
  };
}
