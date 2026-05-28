import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const [tenant, prospectCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: params.id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        },
        linkedInIntegration: { select: { id: true } },
        emailIntegration: { select: { id: true } },
        whatsappIntegration: { select: { id: true } },
        calendlyIntegration: { select: { id: true } },
        _count: { select: { campaigns: true } },
      },
    }),
    prisma.prospect.count({
      where: { campaign: { tenantId: params.id } },
    }),
  ]);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    payment_status: tenant.payment_status,
    createdAt: tenant.createdAt.toISOString(),
    members: tenant.memberships.map((m) => ({
      id: m.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      scopes: m.scopes,
    })),
    stats: {
      campaigns: tenant._count.campaigns,
      prospects: prospectCount,
      hasLinkedIn: Boolean(tenant.linkedInIntegration),
      hasEmail: Boolean(tenant.emailIntegration),
      hasWhatsApp: Boolean(tenant.whatsappIntegration),
      hasCalendly: Boolean(tenant.calendlyIntegration),
    },
  });
}

export async function PATCH(request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = {};
  if (body.name !== undefined) data.name = body.name?.trim() || "";
  if (body.payment_status !== undefined) data.payment_status = Boolean(body.payment_status);

  const tenant = await prisma.tenant.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    payment_status: tenant.payment_status,
  });
}
