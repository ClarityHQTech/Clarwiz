import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authSession";
import {
  fetchSerializedCampaign,
  getOwnedCampaignDetail,
} from "@/lib/campaignDetail";

export async function GET(_request, { params }) {
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

  const serialized = await fetchSerializedCampaign(params.id, user.id);
  if (!serialized) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(serialized);
}

export async function PATCH(request, { params }) {
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

  const campaign = await getOwnedCampaignDetail(params.id, user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "start") {
    if (campaign.prospects.length === 0) {
      return NextResponse.json(
        { error: "Add prospects before starting the drip campaign" },
        { status: 400 }
      );
    }
    if (campaign.status === "active") {
      return NextResponse.json(
        { error: "Drip campaign is already running" },
        { status: 400 }
      );
    }
    if (campaign.status === "completed") {
      return NextResponse.json(
        { error: "Cannot start a completed campaign" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        startDate: campaign.startDate ?? new Date(),
      },
    });

    return NextResponse.json(await fetchSerializedCampaign(params.id, user.id));
  }

  if (body.action === "pause") {
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "Only active campaigns can be paused" },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "paused" },
    });

    return NextResponse.json(await fetchSerializedCampaign(params.id, user.id));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
