import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { prospects: true } },
    },
  });

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      sentCount: campaign.sentCount,
      replyRate: campaign.replyRate,
      openRate: campaign.openRate,
      qualifiedLeads: campaign.qualifiedLeads,
      prospectCount: campaign._count.prospects,
      createdAt: campaign.createdAt.toISOString(),
    })),
  });
}
