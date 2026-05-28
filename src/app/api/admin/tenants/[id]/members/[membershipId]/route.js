import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

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

  const membership = await prisma.tenantMembership.findFirst({
    where: { id: params.membershipId, tenantId: params.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const data = {};
  if (body.role !== undefined) {
    if (body.role !== "ADMIN" && body.role !== "MEMBER") {
      return NextResponse.json(
        { error: "role must be ADMIN or MEMBER" },
        { status: 400 }
      );
    }
    data.role = body.role;
  }
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) {
      return NextResponse.json(
        { error: "scopes must be an array" },
        { status: 400 }
      );
    }
    data.scopes = body.scopes;
  }

  const updated = await prisma.tenantMembership.update({
    where: { id: membership.id },
    data,
    select: {
      id: true,
      tenantId: true,
      role: true,
      scopes: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    tenantId: updated.tenantId,
    role: updated.role,
    scopes: updated.scopes,
    user: updated.user,
  });
}

export async function DELETE(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const membership = await prisma.tenantMembership.findFirst({
    where: { id: params.membershipId, tenantId: params.id },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const adminCount = await prisma.tenantMembership.count({
    where: { tenantId: params.id, role: "ADMIN" },
  });
  if (membership.role === "ADMIN" && adminCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the only tenant admin" },
      { status: 400 }
    );
  }

  await prisma.tenantMembership.delete({ where: { id: membership.id } });
  return NextResponse.json({ success: true });
}
