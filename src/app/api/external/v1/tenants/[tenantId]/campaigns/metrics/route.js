import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest, ensureTenantAccess } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, ok } from "@/lib/externalApi";

export async function GET(request, { params }) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;

  const access = ensureTenantAccess(request, authResult.auth, params.tenantId);
  if (access.error) return access.error;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { id: true },
  });
  if (!tenant) {
    return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Tenant not found.");
  }

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: params.tenantId },
    include: {
      _count: { select: { contactCampaigns: true } },
    },
  });

  const totals = campaigns.reduce(
    (acc, campaign) => {
      acc.totalCampaigns += 1;
      acc.totalProspects += campaign._count.contactCampaigns;
      acc.totalSent += campaign.sentCount;
      acc.totalQualifiedLeads += campaign.qualifiedLeads;
      acc.openRateSum += campaign.openRate;
      acc.replyRateSum += campaign.replyRate;
      return acc;
    },
    {
      totalCampaigns: 0,
      totalProspects: 0,
      totalSent: 0,
      totalQualifiedLeads: 0,
      openRateSum: 0,
      replyRateSum: 0,
    }
  );

  const avgOpenRate = totals.totalCampaigns
    ? Number((totals.openRateSum / totals.totalCampaigns).toFixed(2))
    : 0;
  const avgReplyRate = totals.totalCampaigns
    ? Number((totals.replyRateSum / totals.totalCampaigns).toFixed(2))
    : 0;

  return ok(request, {
    tenantId: params.tenantId,
    totalCampaigns: totals.totalCampaigns,
    totalProspects: totals.totalProspects,
    totalSent: totals.totalSent,
    totalQualifiedLeads: totals.totalQualifiedLeads,
    avgOpenRate,
    avgReplyRate,
  });
}
