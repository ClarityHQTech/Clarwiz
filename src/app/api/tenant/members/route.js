import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { sendTenantInvitationEmail } from "@/lib/email/sendInvitation";
import {
  generateInviteToken,
  inviteExpiresAt,
  normalizeEmail,
} from "@/lib/invitations";

export async function GET() {
  const auth = await resolveApiAuth({
    requirePaid: true,
    permission: PERMISSIONS.MEMBER_MANAGE,
  });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const [memberships, invitations] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tenantInvitation.findMany({
      where: { tenantId: ctx.tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    members: memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      scopes: m.scopes,
      createdAt: m.createdAt.toISOString(),
    })),
    pendingInvitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      scopes: i.scopes,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

export async function POST(request) {
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

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const scopes = Array.isArray(body.scopes) ? body.scopes : [];

  const existingMember = await prisma.tenantMembership.findFirst({
    where: { tenantId: ctx.tenantId, user: { email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "User is already a member of this workspace" },
      { status: 400 }
    );
  }

  await prisma.tenantInvitation.updateMany({
    where: { tenantId: ctx.tenantId, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = generateInviteToken();
  const invitation = await prisma.tenantInvitation.create({
    data: {
      tenantId: ctx.tenantId,
      email,
      role,
      scopes,
      token,
      expiresAt: inviteExpiresAt(),
      invitedById: ctx.user.id,
    },
    include: { tenant: { select: { name: true } } },
  });

  const emailResult = await sendTenantInvitationEmail({
    toEmail: email,
    tenantName: invitation.tenant.name,
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
      emailSent: emailResult.sent,
      ...(emailResult.acceptUrl && !emailResult.sent
        ? { acceptUrl: emailResult.acceptUrl }
        : {}),
    },
    { status: 201 }
  );
}
