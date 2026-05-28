import { prisma } from "@/lib/prisma";

/**
 * Tenant-scoped comm log queries.
 */
export async function fetchCommLogsForTenant(
  tenantId,
  { campaignId, limit = 50 } = {}
) {
  return prisma.communicationLog.findMany({
    where: {
      tenantId,
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
}
