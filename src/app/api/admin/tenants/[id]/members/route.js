import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";
import { sendTenantInvitationEmail } from "@/lib/email/sendInvitation";
import {
  generateInviteToken,
  inviteExpiresAt,
  normalizeEmail,
} from "@/lib/invitations";

export async function POST(request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const scopes = Array.isArray(body.scopes) ? body.scopes : [];

  const existingMember = await prisma.tenantMembership.findFirst({
    where: { tenantId: tenant.id, user: { email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "User is already a member of this tenant" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: existingUser.id,
        role,
        scopes,
      },
      select: {
        id: true,
        role: true,
        scopes: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ membership }, { status: 201 });
  }

  await prisma.tenantInvitation.updateMany({
    where: { tenantId: tenant.id, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = generateInviteToken();
  const invitation = await prisma.tenantInvitation.create({
    data: {
      tenantId: tenant.id,
      email,
      role,
      scopes,
      token,
      expiresAt: inviteExpiresAt(),
      invitedById: ctx.user.id,
    },
  });

  await sendTenantInvitationEmail({
    toEmail: email,
    tenantName: tenant.name,
    token,
    invitedByName: ctx.user.name,
  });

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        scopes: invitation.scopes,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
