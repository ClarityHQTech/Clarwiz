import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest, ensureTenantAccess } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, ok } from "@/lib/externalApi";

export async function GET(request, { params }) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;

  const access = ensureTenantAccess(request, authResult.auth, params.tenantId);
  if (access.error) return access.error;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.campaignId,
      tenantId: params.tenantId,
    },
    include: {
      _count: { select: { contactCampaigns: true, templates: true, commLogs: true } },
    },
  });
  if (!campaign) {
    return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Campaign not found.");
  }

  return ok(request, {
    id: campaign.id,
    tenantId: campaign.tenantId,
    name: campaign.name,
    description: campaign.description,
    targetSegment: campaign.targetSegment,
    goals: campaign.goals,
    status: campaign.status,
    startDate: campaign.startDate?.toISOString() ?? null,
    sentCount: campaign.sentCount,
    openRate: campaign.openRate,
    replyRate: campaign.replyRate,
    qualifiedLeads: campaign.qualifiedLeads,
    calendlyBookingUrl: campaign.calendlyBookingUrl,
    counts: {
      prospects: campaign._count.contactCampaigns,
      templates: campaign._count.templates,
      communicationLogs: campaign._count.commLogs,
    },
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  });
}
