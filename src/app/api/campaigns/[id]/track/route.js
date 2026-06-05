import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchCommLogsForTenant } from "@/lib/commLogs";
import { serializeCommLog } from "@/lib/execution/runCampaignExecution";
import { trackCampaignEngagement } from "@/lib/execution/trackCampaignEngagement";

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

  if (campaign.status === "active") {
    return NextResponse.json(
      {
        error:
          "Tracking on active campaigns is handled by webhooks. Pause the campaign for manual copilot tracking.",
      },
      { status: 400 }
    );
  }

  try {
    const tracking = await trackCampaignEngagement(campaign.id, {
      tenantId: ctx.tenantId,
      prospectIds: body.prospectIds,
      mode: "copilot",
    });

    const commLogs = await fetchCommLogsForTenant(ctx.tenantId, {
      campaignId: campaign.id,
      limit: 50,
    });

    return NextResponse.json({
      ...tracking,
      commLogs: commLogs.map(serializeCommLog),
    });
  } catch (err) {
    console.error("[track]", err);
    return NextResponse.json(
      { error: err.message || "Tracking failed" },
      { status: 500 }
    );
  }
}
