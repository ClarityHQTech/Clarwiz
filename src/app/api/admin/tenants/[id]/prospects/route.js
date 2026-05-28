import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const prospects = await prisma.prospect.findMany({
    where: { campaign: { tenantId: params.id } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      campaign: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json({
    prospects: prospects.map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      email: prospect.email,
      company: prospect.company,
      jobTitle: prospect.jobTitle,
      createdAt: prospect.createdAt.toISOString(),
      qualifiedAt: prospect.qualifiedAt ? prospect.qualifiedAt.toISOString() : null,
      campaign: prospect.campaign,
    })),
  });
}
