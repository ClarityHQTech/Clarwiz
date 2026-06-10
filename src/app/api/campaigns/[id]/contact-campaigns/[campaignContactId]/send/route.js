import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchSerializedCampaign } from "@/lib/campaignDetail";
import { manualCopilotSend } from "@/lib/execution/manualCopilotSend";
import { serializeCommLog } from "@/lib/execution/runCampaignExecution";

export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await manualCopilotSend({
      campaignId: params.id,
      campaignContactId: params.campaignContactId,
      tenantId: ctx.tenantId,
      body,
    });

    const campaign = await fetchSerializedCampaign(params.id, ctx.tenantId);

    return NextResponse.json({
      ...result,
      commLog: result.commLog ? serializeCommLog(result.commLog) : null,
      campaign,
    });
  } catch (err) {
    console.error("[contact send]", err);
    return NextResponse.json(
      { error: err.message || "Send failed" },
      { status: err.message?.includes("not found") ? 404 : 400 }
    );
  }
}
