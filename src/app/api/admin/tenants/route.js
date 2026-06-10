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
import { buildCompanyDetails } from "@/lib/tenantCompanyDetails";

export async function GET(request) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
  const skip = (page - 1) * limit;

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, campaigns: true } },
      },
    }),
    prisma.tenant.count(),
  ]);

  const prospectCounts = await Promise.all(
    tenants.map((tenant) =>
      prisma.campaignContact.count({
        where: { campaign: { tenantId: tenant.id } },
      })
    )
  );

  return NextResponse.json({
    tenants: tenants.map((t, index) => ({
      id: t.id,
      name: t.name,
      payment_status: t.payment_status,
      memberCount: t._count.memberships,
      campaignCount: t._count.campaigns,
      prospectCount: prospectCounts[index] ?? 0,
      createdAt: t.createdAt.toISOString(),
    })),
    pagination: { page, limit, total },
  });
}

export async function POST(request) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

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

  const adminEmail = normalizeEmail(body.adminEmail);
  const payment_status = Boolean(
    body.payment_status !== undefined ? body.payment_status : body.payment
  );

  const company_details = buildCompanyDetails({
    industry: body.industry,
    about: body.about,
    website: body.website,
  });

  const tenant = await prisma.tenant.create({
    data: { name, payment_status, company_details },
  });

  let membership = null;
  let invitation = null;

  if (adminEmail) {
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      membership = await prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: existingUser.id,
          role: "ADMIN",
          scopes: [],
        },
      });
    } else {
      const token = generateInviteToken();
      invitation = await prisma.tenantInvitation.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          role: "ADMIN",
          scopes: [],
          token,
          expiresAt: inviteExpiresAt(),
          invitedById: ctx.user.id,
        },
      });
      await sendTenantInvitationEmail({
        toEmail: adminEmail,
        tenantName: tenant.name,
        token,
        invitedByName: ctx.user.name,
      });
    }
  }

  return NextResponse.json(
    {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        payment_status: tenant.payment_status,
        company_details: tenant.company_details,
      },
      membership: membership
        ? { userId: membership.userId, role: membership.role }
        : null,
      invitation: invitation
        ? { email: invitation.email, expiresAt: invitation.expiresAt.toISOString() }
        : null,
    },
    { status: 201 }
  );
}
