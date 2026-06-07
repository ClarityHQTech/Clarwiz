import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const TYPES = [
  "MARKETING_DOC",
  "PITCH_DECK",
  "BATTLECARD",
  "ONE_PAGER",
  "CASE_STUDY",
  "EMAIL_TEMPLATE",
  "OTHER",
];
const SOURCES = ["GENERATED", "HEYPARROT", "PILOT", "UPLOAD"];
const STAGES = ["LEAD", "DEAL_EARLY", "DEAL_LATE", "ANY"];

/**
 * GET — list the tenant's CollateralIndex, newest first.
 * Optional query filters: type, funnelStage, q (title/tag substring).
 */
export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const sp = new URL(request.url).searchParams;
  const type = sp.get("type");
  const funnelStage = sp.get("funnelStage");
  const q = sp.get("q")?.trim();

  const where = { tenantId: ctx.tenantId };
  if (type && TYPES.includes(type)) where.type = type;
  if (funnelStage && STAGES.includes(funnelStage)) where.funnelStage = funnelStage;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  const items = await prisma.collateralIndex.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}

/**
 * POST (COLLATERAL_MANAGE) — register a collateral item.
 * Requires url OR slug. Upserts by (tenantId, slug) when slug present,
 * otherwise creates a fresh row.
 */
export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const type = body?.type;
  const source = body?.source;
  const funnelStage = body?.funnelStage ?? "ANY";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (!SOURCES.includes(source)) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  if (!STAGES.includes(funnelStage)) return NextResponse.json({ error: "invalid_funnelStage" }, { status: 400 });
  if (!url && !slug) return NextResponse.json({ error: "link_or_slug_required" }, { status: 400 });

  const tags = Array.isArray(body?.tags)
    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const companyHsId = body?.companyHsId ? String(body.companyHsId) : null;
  const dealHsId = body?.dealHsId ? String(body.dealHsId) : null;
  const externalId = body?.externalId ? String(body.externalId) : null;

  const data = {
    tenantId: ctx.tenantId,
    title,
    type,
    source,
    funnelStage,
    tags,
    url: url || null,
    slug: slug || null,
    companyHsId,
    dealHsId,
    externalId,
  };

  let row;
  if (slug) {
    const { tenantId: _t, ...updatable } = data;
    row = await prisma.collateralIndex.upsert({
      where: { tenantId_slug: { tenantId: ctx.tenantId, slug } },
      create: data,
      update: updatable,
    });
  } else {
    row = await prisma.collateralIndex.create({ data });
  }

  return NextResponse.json({ item: row }, { status: 201 });
}

/** DELETE ?id= (COLLATERAL_MANAGE) — remove a tenant-scoped item. */
export async function DELETE(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const existing = await prisma.collateralIndex.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.collateralIndex.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
