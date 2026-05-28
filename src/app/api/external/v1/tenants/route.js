import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, okList, parsePagination } from "@/lib/externalApi";

export async function GET(request) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;
  const { auth } = authResult;

  const { page, limit, skip } = parsePagination(request);

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where: { id: auth.tenantId },
      skip,
      take: limit,
      include: {
        _count: { select: { memberships: true, campaigns: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.count({ where: { id: auth.tenantId } }),
  ]);

  if (tenants.length === 0) {
    return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Tenant not found.");
  }

  const data = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    paymentStatus: tenant.payment_status,
    memberCount: tenant._count.memberships,
    campaignCount: tenant._count.campaigns,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  }));

  return okList(request, data, {
    page,
    limit,
    total,
    hasNext: skip + data.length < total,
  });
}
