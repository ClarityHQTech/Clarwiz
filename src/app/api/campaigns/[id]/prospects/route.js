import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";

function prospectCreateData(campaignId, body) {
  return {
    campaignId,
    name: body.name.trim(),
    firstName: body.firstName?.trim() || null,
    company: body.company?.trim() || null,
    jobTitle: body.jobTitle?.trim() || null,
    painPoint: body.painPoint?.trim() || null,
    phone: body.phone?.trim() || null,
    whatsapp: body.whatsapp?.trim() || null,
    email: body.email?.trim() || null,
    linkedinUrl: body.linkedinUrl?.trim() || null,
  };
}

export async function POST(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const campaign = await getOwnedCampaignDetail(params.id, ctx.tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Prospect name is required" }, { status: 400 });
  }

  await prisma.prospect.create({
    data: prospectCreateData(campaign.id, body),
  });

  const serialized = await fetchSerializedCampaign(params.id, ctx.tenantId);
  return NextResponse.json(serialized, { status: 201 });
}
