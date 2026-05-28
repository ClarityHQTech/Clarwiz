import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchCommLogsForTenant } from "@/lib/commLogs";
import {
  runExecutionForCampaign,
  serializeCommLog,
} from "@/lib/execution/runCampaignExecution";

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

  if (body.mode && body.mode !== "run") {
    return NextResponse.json(
      { error: `Unknown mode: ${body.mode}. Use mode "run".` },
      { status: 400 }
    );
  }

  try {
    const execution = await runExecutionForCampaign(campaign.id, {
      prospectIds: body.prospectIds,
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
      err.message?.includes("OPENAI_API_KEY") ||
      err.message?.includes("API key")
        ? "OpenAI is not configured. Set OPENAI_API_KEY in .env"
        : err.message || "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
