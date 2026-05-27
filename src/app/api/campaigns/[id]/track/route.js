import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { prisma } from "@/lib/prisma";
import { fetchCommLogsForUser } from "@/lib/commLogs";
import { serializeCommLog } from "@/lib/execution/runCampaignExecution";
import { trackCampaignEngagement } from "@/lib/execution/trackCampaignEngagement";

async function getOwnedCampaign(id, userId) {
  return prisma.campaign.findFirst({
    where: { id, userId },
    select: { id: true },
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

  try {
    const tracking = await trackCampaignEngagement(campaign.id, {
      userId: user.id,
      prospectIds: body.prospectIds,
    });

    const commLogs = await fetchCommLogsForUser(user.id, {
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
