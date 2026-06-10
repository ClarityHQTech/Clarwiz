import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";
import {
  buildCompanyDetails,
  parseCompanyDetails,
} from "@/lib/tenantCompanyDetails";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const [tenant, prospectCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        company_details: true,
        payment_status: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            scopes: true,
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
        },
        linkedInIntegration: { select: { id: true } },
        emailIntegration: { select: { id: true } },
        whatsappIntegration: { select: { id: true } },
        calendlyIntegration: { select: { id: true } },
        _count: { select: { campaigns: true } },
      },
    }),
    prisma.campaignContact.count({
      where: { campaign: { tenantId: params.id } },
    }),
  ]);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { industry, about, website } = parseCompanyDetails(tenant.company_details);

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    industry,
    about,
    website,
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
  if (body.payment_status !== undefined) {
    data.payment_status = Boolean(body.payment_status);
  } else if (body.payment !== undefined) {
    data.payment_status = Boolean(body.payment);
  }

  if (
    body.industry !== undefined ||
    body.about !== undefined ||
    body.website !== undefined
  ) {
    const existing = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { company_details: true },
    });
    const current = parseCompanyDetails(existing?.company_details);
    data.company_details = buildCompanyDetails({
      industry: body.industry !== undefined ? body.industry : current.industry,
      about: body.about !== undefined ? body.about : current.about,
      website: body.website !== undefined ? body.website : current.website,
    });
  }

  const tenant = await prisma.tenant.update({
    where: { id: params.id },
    data,
  });

  const { industry, about, website } = parseCompanyDetails(tenant.company_details);

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    industry,
    about,
    website,
    payment_status: tenant.payment_status,
  });
}
