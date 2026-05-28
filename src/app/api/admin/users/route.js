import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function GET(request) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true } },
        memberships: {
          orderBy: { createdAt: "desc" },
          include: { tenant: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      is_superadmin: u.is_superadmin,
      membershipCount: u._count.memberships,
      tenants: u.memberships.map((m) => ({
        membershipId: m.id,
        tenantId: m.tenant.id,
        tenantName: m.tenant.name,
        role: m.role,
        scopes: m.scopes,
        joinedAt: m.createdAt.toISOString(),
      })),
      createdAt: u.createdAt.toISOString(),
    })),
    pagination: { page, limit, total },
  });
}
