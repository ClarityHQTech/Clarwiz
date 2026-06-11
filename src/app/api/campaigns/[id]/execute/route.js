import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchCommLogsForTenant } from "@/lib/commLogs";
import {
  runExecutionForCampaign,
  serializeCommLog,
} from "@/lib/execution/runCampaignExecution";
import { isCronRequestAuthorized } from "@/lib/cronAuth";

async function getOwnedCampaign(id, tenantId) {
  return prisma.campaign.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
}

export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const campaign = await getOwnedCampaign(params.id, ctx.tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const mode = body.mode || "run";
  if (!["run", "copilot_sequential"].includes(mode)) {
    return NextResponse.json(
      { error: `Unknown mode: ${mode}. Use mode "run" or "copilot_sequential".` },
      { status: 400 }
    );
  }

  const cronAuth = isCronRequestAuthorized(request);
  if (campaign.status === "active" && !cronAuth && !body.prospectIds?.length) {
    return NextResponse.json(
      {
        error:
          "Active campaigns use autopilot scheduling. Pause the campaign for manual copilot runs, or pass prospectIds for a single prospect.",
      },
      { status: 400 }
    );
  }

  if (campaign.status === "active" && !cronAuth && body.prospectIds?.length) {
    return NextResponse.json(
      {
        error:
          "Manual execution on active campaigns is disabled. Pause for copilot mode or wait for scheduled outreach.",
      },
      { status: 400 }
    );
  }

  try {
    const execution = await runExecutionForCampaign(campaign.id, {
      prospectIds: body.prospectIds,
      skipDailyLimit: mode === "copilot_sequential" || campaign.status !== "active",
      useProspectSchedule: campaign.status === "active",
    });

    const commLogs = await fetchCommLogsForTenant(ctx.tenantId, {
      campaignId: campaign.id,
      limit: 50,
    });

    return NextResponse.json({
      mode: "run",
      results: execution.results,
      plannedCount: execution.plannedCount,
      commLogs: commLogs.map(serializeCommLog),
    });
  } catch (err) {
    console.error("[execute]", err);
    const message =
      err.message?.includes("ANTHROPIC_API_KEY") ||
      err.message?.includes("API key")
        ? "Anthropic is not configured. Set ANTHROPIC_API_KEY in .env"
        : err.message || "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
