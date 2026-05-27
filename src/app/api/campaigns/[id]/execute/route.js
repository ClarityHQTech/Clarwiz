import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { fetchCommLogsForUser } from "@/lib/commLogs";
import {
  runExecutionForCampaign,
  serializeCommLog,
} from "@/lib/execution/runCampaignExecution";

async function getOwnedCampaign(id, userId) {
  return prisma.campaign.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });
}

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

  const campaign = await getOwnedCampaign(params.id, user.id);
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

    const commLogs = await fetchCommLogsForUser(user.id, {
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
