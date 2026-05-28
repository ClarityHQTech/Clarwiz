import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";

export async function PATCH(request, { params }) {
  const auth = await resolveApiAuth({
    requirePaid: true,
    permission: PERMISSIONS.MEMBER_MANAGE,
  });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (membership.role === "ADMIN" && membership.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own admin role" },
      { status: 400 }
    );
  }

  const data = {};
  if (body.scopes !== undefined) {
    data.scopes = Array.isArray(body.scopes) ? body.scopes : [];
  }
  if (body.role === "MEMBER" || body.role === "ADMIN") {
    data.role = body.role;
  }

  const updated = await prisma.tenantMembership.update({
    where: { id: membership.id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    scopes: updated.scopes,
  });
}

export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({
    requirePaid: true,
    permission: PERMISSIONS.MEMBER_MANAGE,
  });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const membership = await prisma.tenantMembership.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (membership.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself" },
      { status: 400 }
    );
  }

  const adminCount = await prisma.tenantMembership.count({
    where: { tenantId: ctx.tenantId, role: "ADMIN" },
  });
  if (membership.role === "ADMIN" && adminCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the only workspace admin" },
      { status: 400 }
    );
  }

  await prisma.tenantMembership.delete({ where: { id: membership.id } });
  return NextResponse.json({ success: true });
}
