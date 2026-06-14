/**
 * Shared MOFU action logger — the single writer used by every assist action
 * (NBA, email draft, collateral, task, note, promote, chat). Fire-and-forget:
 * a logging failure must never block the user's actual action.
 *
 * `action` is a Prisma `AssistAction` enum value:
 *   INSIGHT_COMPUTED · NBA_DRAFTED · NBA_EXECUTED · EMAIL_DRAFTED ·
 *   COLLATERAL_SENT · TASK_CREATED · NOTE_ADDED · DEAL_CREATED ·
 *   MEETING_SCHEDULED · CHAT_QUERY
 */
export async function logAssistAction(
  prisma,
  {
    tenantId,
    actorUserId = null,
    entityType,
    hsObjectId = null,
    action,
    payload = null,
    modelUsed = null,
    providerUsage = null,
    providerCost = null,
  }
) {
  try {
    return await prisma.assistActionLog.create({
      data: {
        tenantId,
        actorUserId,
        entityType,
        hsObjectId,
        action,
        payload,
        modelUsed,
        providerUsage,
        providerCost,
      },
    });
  } catch (err) {
    console.warn(`[MOFU] action-log write failed (${action}): ${err.message}`);
    return null;
  }
}

/** Newest-first activity feed for the dashboard right rail. */
export async function recentAssistActions(prisma, tenantId, limit = 20) {
  return prisma.assistActionLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
