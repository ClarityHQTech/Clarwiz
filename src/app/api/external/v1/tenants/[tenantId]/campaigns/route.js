import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest, ensureTenantAccess } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, okList, parsePagination } from "@/lib/externalApi";

function serializeCampaign(campaign) {
  return {
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
    prospectCount: campaign._count.contactCampaigns,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export async function GET(request, { params }) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;

  const access = ensureTenantAccess(request, authResult.auth, params.tenantId);
  if (access.error) return access.error;

  const { page, limit, skip } = parsePagination(request);
  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: params.tenantId },
      include: { _count: { select: { contactCampaigns: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.campaign.count({ where: { tenantId: params.tenantId } }),
  ]);

  if (campaigns.length === 0 && page === 1) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Tenant not found.");
    }
  }

  const data = campaigns.map(serializeCampaign);
  return okList(request, data, {
    page,
    limit,
    total,
    hasNext: skip + data.length < total,
  });
}
