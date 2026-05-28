import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";
import { generateExternalApiKey } from "@/lib/apiKeyAuth";

function serializeApiKey(key) {
  return {
    id: key.id,
    tenantId: key.tenantId,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
    revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
    createdAt: key.createdAt.toISOString(),
    createdBy: key.createdBy,
  };
}

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const keys = await prisma.externalApiKey.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    apiKeys: keys.map(serializeApiKey),
  });
}

export async function POST(request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true },
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

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter(Boolean) : ["read:all"];
  const expiresAt =
    body.expiresAt && !Number.isNaN(new Date(body.expiresAt).getTime())
      ? new Date(body.expiresAt)
      : null;

  const generated = generateExternalApiKey();
  const created = await prisma.externalApiKey.create({
    data: {
      tenantId: params.id,
      name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      scopes,
      expiresAt,
      createdBy: ctx.user.id,
    },
  });

  return NextResponse.json(
    {
      apiKey: generated.rawKey,
      meta: serializeApiKey(created),
      warning: "Store this key securely. It will not be shown again.",
    },
    { status: 201 }
  );
}
