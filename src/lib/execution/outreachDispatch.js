import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, getCronSecret } from "@/lib/cronAuth";
import { TERMINAL_CAMPAIGN_CONTACT_STATUSES } from "@/lib/campaignContactStatus";

/** Lease while a worker runs — prevents duplicate dispatch from the next minute cron. */
export const OUTREACH_CLAIM_LEASE_MS = 15 * 60_000;

const DEFAULT_DISPATCH_LIMIT = 100;
const DEFAULT_DISPATCH_CONCURRENCY = 50;

export function getOutreachDispatchLimit() {
  const n = parseInt(process.env.OUTREACH_DISPATCH_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DISPATCH_LIMIT;
}

export function getOutreachDispatchConcurrency() {
  const n = parseInt(process.env.OUTREACH_DISPATCH_CONCURRENCY ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DISPATCH_CONCURRENCY;
}

/**
 * Atomically mark a due contact as in-flight (lease on nextScheduledOutreachAt).
 * @returns {boolean} true when this invocation won the claim
 */
export async function claimContactForOutreach(campaignContactId, now = new Date()) {
  const leaseUntil = new Date(now.getTime() + OUTREACH_CLAIM_LEASE_MS);

  const result = await prisma.campaignContact.updateMany({
    where: {
      id: campaignContactId,
      nextScheduledOutreachAt: { lte: now },
      status: { notIn: [...TERMINAL_CAMPAIGN_CONTACT_STATUSES] },
      campaign: { status: "active" },
    },
    data: { nextScheduledOutreachAt: leaseUntil },
  });

  return result.count > 0;
}

export function outreachWorkerUrl() {
  return `${getAppBaseUrl()}/api/cron/outreach/worker`;
}

export async function dispatchOutreachWorker({ campaignId, campaignContactId }) {
  const secret = getCronSecret();
  if (!secret) {
    throw new Error("SECRET is not configured for outreach worker dispatch");
  }

  const res = await fetch(outreachWorkerUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ campaignId, campaignContactId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Worker HTTP ${res.status}`);
  }
  return data;
}

/** Run async tasks with a fixed concurrency cap (no extra deps). */
export async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((item) => fn(item)));
    results.push(...settled);
  }
  return results;
}
