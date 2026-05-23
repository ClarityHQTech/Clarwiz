import { prisma } from "@/lib/prisma";

/**
 * Tenant-scoped comm log queries (userId = tenant boundary).
 */
export async function fetchCommLogsForUser(
  userId,
  { campaignId, limit = 50 } = {}
) {
  return prisma.communicationLog.findMany({
    where: {
      userId,
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
}
