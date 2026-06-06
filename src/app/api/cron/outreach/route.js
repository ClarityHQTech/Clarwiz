import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runScheduledOutreachForProspect,
  retryCommLogPush,
} from "@/lib/execution/runCampaignExecution";
import { isCronRequestAuthorized, isOutreachCronEnabled } from "@/lib/cronAuth";
import { TERMINAL_CONTACT_CAMPAIGN_STATUSES } from "@/lib/contactCampaignStatus";

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
  const summary = {
    scheduledProspects: 0,
    retries: 0,
    errors: [],
    results: [],
  };

  const dueContacts = await prisma.contactCampaign.findMany({
    where: {
      campaign: { status: "active" },
      status: { notIn: [...TERMINAL_CONTACT_CAMPAIGN_STATUSES] },
      nextScheduledOutreachAt: { lte: now },
    },
    include: {
      campaign: { select: { id: true, status: true, tenantId: true } },
    },
    take: 50,
  });

  for (const cc of dueContacts) {
    try {
      const result = await runScheduledOutreachForProspect(
        cc.campaignId,
        cc.id
      );
      summary.results.push(result);
      if (!result.skipped) summary.scheduledProspects += 1;
    } catch (err) {
      summary.errors.push({ prospectId: cc.id, error: err.message });
    }
  }

  const retryLogs = await prisma.communicationLog.findMany({
    where: {
      status: "retry_pending",
      nextRetryAt: { lte: now },
    },
    take: 20,
  });

  for (const log of retryLogs) {
    try {
      await retryCommLogPush(log);
      summary.retries += 1;
    } catch (err) {
      summary.errors.push({ logId: log.id, error: err.message });
    }
  }

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    ...summary,
  });
}
