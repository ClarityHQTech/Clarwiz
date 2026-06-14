import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retryCommLogPush } from "@/lib/execution/runCampaignExecution";
import { isCronRequestAuthorized, isOutreachCronEnabled } from "@/lib/cronAuth";
import {
  MAX_OUTREACH_RETRIES,
  scheduleOutreachRetry,
} from "@/lib/execution/outreachRetry";
import { TERMINAL_CAMPAIGN_CONTACT_STATUSES } from "@/lib/campaignContactStatus";
import {
  claimContactForOutreach,
  dispatchOutreachWorker,
  getOutreachDispatchConcurrency,
  getOutreachDispatchLimit,
  runWithConcurrency,
} from "@/lib/execution/outreachDispatch";

/** Dispatcher only — fans out one serverless worker per due contact. */
export const maxDuration =
  Number(process.env.SERVERLESS_MAX_DURATION) || 300;

export async function GET(request) {
  return runOutreachCron(request);
}

export async function POST(request) {
  return runOutreachCron(request);
}

async function runOutreachCron(request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOutreachCronEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        "Outreach cron is disabled. Set OUTREACH_CRON_ENABLED=true and add vercel.cron.pro.example.json to vercel.json (Vercel Pro).",
    });
  }

  const now = new Date();
  const dispatchLimit = getOutreachDispatchLimit();
  const concurrency = getOutreachDispatchConcurrency();

  const dueContacts = await prisma.campaignContact.findMany({
    where: {
      campaign: { status: "active" },
      status: { notIn: [...TERMINAL_CAMPAIGN_CONTACT_STATUSES] },
      nextScheduledOutreachAt: { lte: now },
    },
    select: { id: true, campaignId: true },
    take: dispatchLimit,
  });

  const claimed = [];
  for (const cc of dueContacts) {
    try {
      if (await claimContactForOutreach(cc.id, now)) {
        claimed.push(cc);
      }
    } catch (err) {
      console.warn("[outreach-cron] claim failed:", cc.id, err.message);
    }
  }

  const dispatchResults = await runWithConcurrency(
    claimed,
    concurrency,
    async (cc) => {
      const data = await dispatchOutreachWorker({
        campaignId: cc.campaignId,
        campaignContactId: cc.id,
      });
      return data.result ?? data;
    }
  );

  const errors = [];
  let dispatched = 0;
  let sent = 0;

  for (let i = 0; i < dispatchResults.length; i++) {
    const outcome = dispatchResults[i];
    const cc = claimed[i];
    if (outcome.status === "fulfilled") {
      dispatched += 1;
      if (!outcome.value?.skipped) sent += 1;
    } else {
      errors.push({
        prospectId: cc.id,
        error: outcome.reason?.message ?? String(outcome.reason),
      });
    }
  }

  const retryLogs = await prisma.communicationLog.findMany({
    where: {
      status: "retry_pending",
      nextRetryAt: { lte: now },
      retryCount: { lt: MAX_OUTREACH_RETRIES },
    },
    take: 20,
  });

  let retries = 0;
  for (const log of retryLogs) {
    try {
      await retryCommLogPush(log);
      retries += 1;
    } catch (err) {
      errors.push({ logId: log.id, error: err.message });
      try {
        await scheduleOutreachRetry(log.id, {
          error: err.message,
          retryCount: log.retryCount,
        });
      } catch (retryErr) {
        errors.push({ logId: log.id, error: retryErr.message });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    due: dueContacts.length,
    claimed: claimed.length,
    dispatched,
    sent,
    retries,
    concurrency,
    errors,
  });
}
