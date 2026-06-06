import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySlackSignature, parseSlackAction } from "@/lib/mofu/slack";
import { draftRecommendation, approveRecommendation, executeRecommendation } from "@/lib/mofu/execution/rails";

// POST /api/mofu/slack/interactivity — Slack block-action (Approve & send) handler.
export async function POST(request) {
  const rawBody = await request.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody,
    signature: request.headers.get("x-slack-signature"),
  });
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  let payload;
  try {
    payload = JSON.parse(params.get("payload") || "{}");
  } catch {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const action = parseSlackAction(payload);
  if (!action) return NextResponse.json({ text: "No action." });

  const link = await prisma.integrationWebhook
    .findFirst({ where: { provider: "slack", providerMeta: { path: ["teamId"], equals: action.teamId } } })
    .catch(() => null);
  if (!link) return NextResponse.json({ text: "Slack workspace not linked to a Clarwiz tenant." });

  if (action.actionId?.startsWith("approve_")) {
    const recId = action.value;
    await draftRecommendation({ tenantId: link.tenantId, recId });
    await approveRecommendation({ tenantId: link.tenantId, recId, actor: "slack" });
    const r = await executeRecommendation({ tenantId: link.tenantId, recId, actor: "slack", surface: "slack" });
    return NextResponse.json({
      replace_original: false,
      text: r.ok ? "✅ Approved — sent via HubSpot, logged as an engagement." : `⚠️ Could not send: ${r.reason}`,
    });
  }
  return NextResponse.json({ text: "Unsupported action." });
}
