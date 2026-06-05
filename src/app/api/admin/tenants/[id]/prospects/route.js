import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";
import { CONTACT_CAMPAIGN_STATUS_LABELS } from "@/lib/contactCampaignStatus";
import { CONTACT_PERSONA_LABELS } from "@/lib/contactPersona";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const rows = await prisma.contactCampaign.findMany({
    where: { campaign: { tenantId: params.id } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      campaign: { select: { id: true, name: true, status: true } },
      contact: {
        include: {
          businessUser: { include: { company: true } },
        },
      },
    },
  });

  return NextResponse.json({
    prospects: rows.map((cc) => ({
      id: cc.id,
      contactId: cc.contactId,
      name: cc.contact.businessUser.name,
      email: cc.contact.businessUser.email,
      company: cc.contact.businessUser.company?.name ?? null,
      jobTitle: cc.contact.businessUser.jobTitle,
      persona: cc.contact.persona,
      personaLabel: CONTACT_PERSONA_LABELS[cc.contact.persona],
      status: cc.status,
      statusLabel: CONTACT_CAMPAIGN_STATUS_LABELS[cc.status],
      createdAt: cc.createdAt.toISOString(),
      qualifiedAt: cc.qualifiedAt ? cc.qualifiedAt.toISOString() : null,
      campaign: cc.campaign,
    })),
  });
}
