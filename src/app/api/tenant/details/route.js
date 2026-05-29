import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireAuth, requireTenant } from "@/lib/requireAuth";
import {
  buildCompanyDetails,
  parseCompanyDetails,
} from "@/lib/tenantCompanyDetails";

function canManageTenantDetails(ctx) {
  return ctx.isSuperadmin || ctx.tenantRole === "ADMIN";
}

export async function GET() {
  const ctx = await getAuthContext();
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;
  const tenantErr = requireTenant(ctx);
  if (tenantErr) return tenantErr;

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      id: true,
      name: true,
      company_details: true,
      payment_status: true,
    },
  });

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
    canEdit: canManageTenantDetails(ctx),
  });
}

export async function PATCH(request) {
  const ctx = await getAuthContext();
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;
  const tenantErr = requireTenant(ctx);
  if (tenantErr) return tenantErr;

  if (!canManageTenantDetails(ctx)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = {};
  if (body.name !== undefined) {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    data.name = name;
  }

  if (
    body.industry !== undefined ||
    body.about !== undefined ||
    body.website !== undefined
  ) {
    const existing = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
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
    where: { id: ctx.tenantId },
    data,
    select: {
      id: true,
      name: true,
      company_details: true,
      payment_status: true,
    },
  });

  const { industry, about, website } = parseCompanyDetails(tenant.company_details);

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    industry,
    about,
    website,
    payment_status: tenant.payment_status,
    canEdit: true,
  });
}
