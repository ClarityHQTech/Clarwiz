import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function PATCH(request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await request.json().catch(() => null);
  return NextResponse.json(
    {
      error:
        "Platform role updates are disabled in admin panel. Grant super admin access directly in database.",
    },
    { status: 403 }
  );
}
