import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySlackSignature, parseSlashCommand, buildDealNbaResponse } from "@/lib/mofu/slack";
import { getDealInsights } from "@/lib/mofu/insightsReader";

// POST /api/mofu/slack — Slack slash command. Verifies signing secret; acks fast.
export async function POST(request) {
  const rawBody = await request.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const ok = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody,
    signature: request.headers.get("x-slack-signature"),
  });
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  const { command, arg } = parseSlashCommand(params.get("text") || "");

  // Map Slack team -> tenant (per-tenant config). Without a mapping, respond ephemerally.
  const teamId = params.get("team_id");
  const link = await prisma.integrationWebhook.findFirst({
    where: { provider: "slack", providerMeta: { path: ["teamId"], equals: teamId } },
  }).catch(() => null);
  if (!link) {
    return NextResponse.json({ response_type: "ephemeral", text: "Slack workspace not linked to a Clarwiz tenant yet." });
  }

  if (command !== "deal" || !arg) {
    return NextResponse.json({ response_type: "ephemeral", text: "Usage: /clarwiz deal <deal name>" });
  }

  const deal = await prisma.deal.findFirst({
    where: { tenantId: link.tenantId, name: { contains: arg, mode: "insensitive" } },
  });
  if (!deal) return NextResponse.json({ response_type: "ephemeral", text: `No deal matching "${arg}".` });

  const insights = await getDealInsights({ tenantId: link.tenantId, hubspotDealId: deal.hubspotDealId });
  return NextResponse.json(buildDealNbaResponse({ dealName: deal.name ?? arg, cards: insights.ok ? insights.cards : [] }));
}
