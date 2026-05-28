/** Engagement tracking rules: docs/execution-layer-rules.md §8 */
import { prisma } from "@/lib/prisma";
import { syncCampaignMetrics } from "@/lib/campaignMetrics";
import { checkEmailEngagementForProspect } from "@/lib/execution/checkEmailEngagement";
import { checkLinkedInEngagementForCampaign } from "@/lib/execution/checkLinkedInEngagement";
import { checkWhatsAppEngagementForCampaign } from "@/lib/execution/checkWhatsAppEngagement";
import { runExecutionForCampaign } from "@/lib/execution/runCampaignExecution";
import { runPostTrackQualification } from "@/lib/execution/qualifyProspect";

const PENDING_STATUSES = ["planned", "queued", "sent", "delivered"];

async function loadTrackingContext(campaignId, prospectIds) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      prospects: {
        orderBy: { name: "asc" },
        ...(prospectIds?.length ? { where: { id: { in: prospectIds } } } : {}),
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
      ...(prospectIds?.length ? { prospectId: { in: prospectIds } } : {}),
    },
    orderBy: { sentAt: "desc" },
  });

  const linkedInLogs = await prisma.communicationLog.findMany({
    where: {
      campaignId,
      channel: "linkedin",
      ...(prospectIds?.length ? { prospectId: { in: prospectIds } } : {}),
    },
    select: {
      id: true,
      prospectId: true,
      ctaType: true,
      status: true,
      sentAt: true,
      deliveredAt: true,
      responseType: true,
      deliveryMeta: true,
    },
    orderBy: { sentAt: "desc" },
  });

  const pendingLogsByProspect = new Map();
  for (const log of pendingLogs) {
    const list = pendingLogsByProspect.get(log.prospectId) ?? [];
    list.push(log);
    pendingLogsByProspect.set(log.prospectId, list);
  }

  const linkedInLogsByProspect = new Map();
  for (const log of linkedInLogs) {
    const list = linkedInLogsByProspect.get(log.prospectId) ?? [];
    list.push(log);
    linkedInLogsByProspect.set(log.prospectId, list);
  }

  return {
    campaign,
    prospects: campaign.prospects,
    pendingLogsByProspect,
    linkedInLogsByProspect,
  };
}

/**
 * Track engagement across email, LinkedIn, and WhatsApp for all campaign prospects.
 */
export async function trackCampaignEngagement(
  campaignId,
  { tenantId, prospectIds } = {}
) {
  const { campaign, prospects, pendingLogsByProspect, linkedInLogsByProspect } =
    await loadTrackingContext(campaignId, prospectIds);

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

    await runExecutionForCampaign(campaignId, { prospectIds: [prospectId] });
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
          prospectIds: [...qualifyProspectIds],
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
