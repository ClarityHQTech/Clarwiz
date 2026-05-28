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
      _count: {
        select: {
          prospects: true,
          commLogs: true,
          signals: true,
        },
      },
    },
  });
  if (!campaign) {
    return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Campaign not found.");
  }

  return ok(request, {
    campaignId: campaign.id,
    tenantId: campaign.tenantId,
    metrics: {
      prospects: campaign._count.prospects,
      communicationLogs: campaign._count.commLogs,
      prospectSignals: campaign._count.signals,
      sentCount: campaign.sentCount,
      openRate: campaign.openRate,
      replyRate: campaign.replyRate,
      qualifiedLeads: campaign.qualifiedLeads,
    },
    generatedAt: new Date().toISOString(),
  });
}
