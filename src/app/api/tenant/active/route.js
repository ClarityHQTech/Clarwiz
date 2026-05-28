import { NextResponse } from "next/server";
import { getAuthContext, setActiveTenantCookie } from "@/lib/authContext";
import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/lib/prisma";

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

  const tenantId = body.tenantId?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  if (!ctx.isSuperadmin) {
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: ctx.user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { payment_status: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  await setActiveTenantCookie(tenantId);
  if (!tenant.payment_status) {
    return NextResponse.json(
      { error: "PaymentRequired", message: "Selected workspace requires payment.", tenantId },
      { status: 402 }
    );
  }
  return NextResponse.json({ success: true, tenantId });
}
