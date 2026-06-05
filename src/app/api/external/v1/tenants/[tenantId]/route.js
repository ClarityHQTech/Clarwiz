import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest, ensureTenantAccess } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, ok } from "@/lib/externalApi";

export async function GET(request, { params }) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;

  const access = ensureTenantAccess(request, authResult.auth, params.tenantId);
  if (access.error) return access.error;

  const [tenant, prospectCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: params.tenantId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { campaigns: true } },
      },
    }),
    prisma.contactCampaign.count({
      where: { campaign: { tenantId: params.tenantId } },
    }),
  ]);

  if (!tenant) {
    return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Tenant not found.");
  }

  return ok(request, {
    id: tenant.id,
    name: tenant.name,
    paymentStatus: tenant.payment_status,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    members: tenant.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      scopes: m.scopes,
      joinedAt: m.createdAt.toISOString(),
    })),
    stats: {
      campaigns: tenant._count.campaigns,
      prospects: prospectCount,
    },
  });
}
