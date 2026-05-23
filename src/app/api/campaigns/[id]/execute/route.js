import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import { fetchCommLogsForUser } from "@/lib/commLogs";
import {
  runExecutionForCampaign,
  simulateProspectReply,
  simulateProspectSignal,
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

  const campaign = await getOwnedCampaign(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.mode === "simulate_reply") {
      if (!body.prospectId) {
        return NextResponse.json(
          { error: "prospectId is required for simulate_reply" },
          { status: 400 }
        );
      }

      const prospect = await prisma.prospect.findFirst({
        where: { id: body.prospectId, campaignId: campaign.id },
      });
      if (!prospect) {
        return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
      }

      const result = await simulateProspectReply({
        campaignId: campaign.id,
        prospectId: body.prospectId,
        content: body.content,
      });

      const commLogs = await fetchCommLogsForUser(user.id, {
        campaignId: campaign.id,
        limit: 50,
      });

      return NextResponse.json({
        mode: "simulate_reply",
        replyRecordedOn: result.replyRecordedOn,
        replyContent: result.replyContent,
        results: result.execution.results,
        plannedCount: result.execution.plannedCount,
        commLogs: commLogs.map(serializeCommLog),
      });
    }

    if (body.mode === "simulate_signal") {
      if (!body.prospectId) {
        return NextResponse.json(
          { error: "prospectId is required for simulate_signal" },
          { status: 400 }
        );
      }

      const prospect = await prisma.prospect.findFirst({
        where: { id: body.prospectId, campaignId: campaign.id },
      });
      if (!prospect) {
        return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
      }

      const result = await simulateProspectSignal({
        campaignId: campaign.id,
        prospectId: body.prospectId,
        type: body.type,
        source: body.source,
        content: body.content,
      });

      const commLogs = await fetchCommLogsForUser(user.id, {
        campaignId: campaign.id,
        limit: 50,
      });

      return NextResponse.json({
        mode: "simulate_signal",
        signal: result.signal,
        results: result.execution.results,
        plannedCount: result.execution.plannedCount,
        commLogs: commLogs.map(serializeCommLog),
      });
    }

    if (body.mode === "run" || !body.mode) {
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
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
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
