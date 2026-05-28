import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { setActiveTenantCookie } from "@/lib/authContext";

const INVITE_EXPIRY_DAYS = 7;

export function normalizeEmail(email) {
  return email?.trim()?.toLowerCase() ?? "";
}

export function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

export function inviteExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_EXPIRY_DAYS);
  return d;
}

export async function acceptInvitation({ token, userEmail, userId }) {
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { token },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (!invitation || invitation.status !== "PENDING") {
    throw new Error("Invalid or expired invitation");
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Invitation has expired");
  }

  const normalizedInvite = normalizeEmail(invitation.email);
  const normalizedUser = normalizeEmail(userEmail);
  if (normalizedInvite !== normalizedUser) {
    throw new Error(
      `This invitation was sent to ${invitation.email}. Sign in with that Google account.`
    );
  }

  const membership = await prisma.$transaction(async (tx) => {
    await tx.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    return tx.tenantMembership.upsert({
      where: {
        tenantId_userId: { tenantId: invitation.tenantId, userId },
      },
      create: {
        tenantId: invitation.tenantId,
        userId,
        role: invitation.role,
        scopes: invitation.scopes,
      },
      update: {
        role: invitation.role,
        scopes: invitation.scopes,
      },
    });
  });

  await setActiveTenantCookie(invitation.tenantId);

  return {
    membership,
    tenant: invitation.tenant,
  };
}
