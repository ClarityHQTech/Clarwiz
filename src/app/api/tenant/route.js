import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, setActiveTenantCookie } from "@/lib/authContext";
import { requireAuth } from "@/lib/requireAuth";

export async function POST(request) {
  const ctx = await getAuthContext();
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const existingMembership = await prisma.tenantMembership.findFirst({
    where: { userId: ctx.user.id },
    select: { id: true },
  });
  if (existingMembership) {
    return NextResponse.json(
      { error: "Workspace already exists for this user." },
      { status: 400 }
    );
  }

  const tenant = await prisma.tenant.create({
    data: {
      name,
      company_details: body.company_details ?? null,
      payment_status: false,
      memberships: {
        create: {
          userId: ctx.user.id,
          role: "ADMIN",
          scopes: [],
        },
      },
    },
    select: { id: true, name: true, payment_status: true },
  });

  await setActiveTenantCookie(tenant.id);
  return NextResponse.json({ tenant }, { status: 201 });
}
