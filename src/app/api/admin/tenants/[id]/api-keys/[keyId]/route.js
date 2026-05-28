import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function DELETE(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const existing = await prisma.externalApiKey.findFirst({
    where: {
      id: params.keyId,
      tenantId: params.id,
      revokedAt: null,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await prisma.externalApiKey.update({
    where: { id: params.keyId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
