import { prisma } from "@/lib/prisma";

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000];
export const MAX_OUTREACH_RETRIES = 3;

export function nextRetryDelayMs(retryCount) {
  return RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
}

export async function scheduleOutreachRetry(logId, { error, retryCount } = {}) {
  const count = (retryCount ?? 0) + 1;
  if (count > MAX_OUTREACH_RETRIES) {
    await prisma.communicationLog.update({
      where: { id: logId },
      data: {
        status: "failed",
        decisionReason: `Failed after ${MAX_OUTREACH_RETRIES} retries: ${error ?? "unknown"}`,
        lastRetryAt: new Date(),
      },
    });
    return { exhausted: true, retryCount: count };
  }

  const nextRetryAt = new Date(Date.now() + nextRetryDelayMs(count - 1));
  await prisma.communicationLog.update({
    where: { id: logId },
    data: {
      status: "retry_pending",
      retryCount: count,
      lastRetryAt: new Date(),
      nextRetryAt,
      decisionReason: `Retry ${count}/${MAX_OUTREACH_RETRIES}: ${error ?? "send failed"}`,
    },
  });
  return { exhausted: false, retryCount: count, nextRetryAt };
}

export function storePlannedDecisionInMeta(decision) {
  return {
    plannedDecision: {
      channel: decision.channel,
      templateId: decision.templateId,
      whatsappSendMode: decision.whatsappSendMode ?? null,
      stage: decision.stage,
      subject: decision.subject,
      message: decision.message,
      ctaType: decision.ctaType,
      decisionReason: decision.decisionReason,
    },
  };
}
