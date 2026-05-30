import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";

export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const campaign = await getOwnedCampaignDetail(params.id, ctx.tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const prospect = campaign.prospects.find((p) => p.id === params.prospectId);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  await prisma.prospect.delete({ where: { id: params.prospectId } });

  const serialized = await fetchSerializedCampaign(params.id, ctx.tenantId);
  return NextResponse.json(serialized);
}
