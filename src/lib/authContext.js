import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import authOptions from "@/app/auth/options";
import { prisma } from "@/lib/prisma";

export const ACTIVE_TENANT_COOKIE = "activeTenantId";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      is_superadmin: true,
    },
  });
}

export async function getUserMemberships(userId) {
  return prisma.tenantMembership.findMany({
    where: { userId },
    include: {
      tenant: { select: { id: true, name: true, payment_status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function resolveActiveTenantId(user, cookieTenantId) {
  const isSuperAdmin = user.is_superadmin === true;

  if (cookieTenantId) {
    if (isSuperAdmin) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: cookieTenantId },
        select: { id: true },
      });
      if (tenant) return cookieTenantId;
    } else {
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: { tenantId: cookieTenantId, userId: user.id },
        },
      });
      if (membership) return cookieTenantId;
    }
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });

  if (memberships.length === 1) {
    return memberships[0].tenantId;
  }

  return null;
}

/**
 * @returns {Promise<null | {
 *   user: object,
 *   tenantId: string | null,
 *   tenant: { id: string, name: string, payment_status: boolean } | null,
 *   tenantRole: string | null,
 *   isSuperadmin: boolean,
 *   scopes: string[],
 *   isTenantActive: boolean,
 *   needsTenantSelection: boolean,
 *   memberships: array,
 * }>}
 */
export async function getAuthContext() {
  const user = await getSessionUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const cookieTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value || null;
  const memberships = await getUserMemberships(user.id);
  const isSuperAdmin = user.is_superadmin === true;

  let tenantId = await resolveActiveTenantId(user, cookieTenantId);

  if (!tenantId && memberships.length === 1) {
    tenantId = memberships[0].tenantId;
  }

  if (!tenantId) {
    return {
      user,
      tenantId: null,
      tenant: null,
      tenantRole: null,
      isSuperadmin: isSuperAdmin,
      scopes: [],
      isTenantActive: false,
      needsTenantSelection: !isSuperAdmin && memberships.length !== 1,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
        scopes: m.scopes,
        payment_status: m.tenant.payment_status,
      })),
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, payment_status: true },
  });

  if (!tenant) {
    return {
      user,
      tenantId: null,
      tenant: null,
      tenantRole: null,
      isSuperadmin: isSuperAdmin,
      scopes: [],
      isTenantActive: false,
      needsTenantSelection: true,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
        scopes: m.scopes,
        payment_status: m.tenant.payment_status,
      })),
    };
  }

  let tenantRole = null;
  let scopes = [];

  if (isSuperAdmin) {
    tenantRole = null;
  } else {
    const membership = memberships.find((m) => m.tenantId === tenantId);
    if (!membership) {
      return {
        user,
        tenantId: null,
        tenant: null,
        tenantRole: null,
        isSuperadmin: false,
        scopes: [],
        isTenantActive: false,
        needsTenantSelection: true,
        memberships: memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
          scopes: m.scopes,
          payment_status: m.tenant.payment_status,
        })),
      };
    }
    tenantRole = membership.role;
    scopes = membership.scopes || [];
  }

  const isTenantMember = isSuperAdmin ? true : Boolean(tenantRole);
  const isTenantAdmin = isSuperAdmin || tenantRole === "ADMIN";
  const isTenantActive = Boolean(tenant.payment_status);

  return {
    user,
    tenantId: tenant.id,
    tenant,
    tenantRole,
    isSuperadmin: isSuperAdmin,
    isTenantAdmin,
    isTenantMember,
    isTenantActive,
    scopes,
    hasScope: (scope) => isSuperAdmin || isTenantAdmin || scopes.includes(scope),
    needsTenantSelection: false,
    memberships: memberships.map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      role: m.role,
      scopes: m.scopes,
      payment_status: m.tenant.payment_status,
    })),
  };
}

export async function setActiveTenantCookie(tenantId) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
