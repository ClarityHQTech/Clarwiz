import { prisma } from "@/lib/prisma";
import { authenticateApiKeyRequest, ensureTenantAccess } from "@/lib/apiKeyAuth";
import { error, ExternalErrorCodes, okList, parsePagination } from "@/lib/externalApi";

export async function GET(request, { params }) {
  const authResult = await authenticateApiKeyRequest(request);
  if (authResult.error) return authResult.error;

  const access = ensureTenantAccess(request, authResult.auth, params.tenantId);
  if (access.error) return access.error;

  const { page, limit, skip } = parsePagination(request);

  const [memberships, total] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { tenantId: params.tenantId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.tenantMembership.count({
      where: { tenantId: params.tenantId },
    }),
  ]);

  if (memberships.length === 0 && page === 1) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return error(request, 404, ExternalErrorCodes.NOT_FOUND, "Tenant not found.");
    }
  }

  const data = memberships.map((membership) => ({
    id: membership.id,
    userId: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    image: membership.user.image,
    role: membership.role,
    scopes: membership.scopes,
    joinedAt: membership.createdAt.toISOString(),
  }));

  return okList(request, data, {
    page,
    limit,
    total,
    hasNext: skip + data.length < total,
  });
}
