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
const CATEGORIES = ["MARKETING", "SALES"];

/**
 * GET — list the tenant's CollateralIndex, newest first.
 * Optional query filters: type, funnelStage, q (title/tag substring),
 * templates=1 (only brand-template rows).
 */
export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const sp = new URL(request.url).searchParams;
  const type = sp.get("type");
  const funnelStage = sp.get("funnelStage");
  const q = sp.get("q")?.trim();
  const templatesOnly = sp.get("templates") === "1";

  const where = { tenantId: ctx.tenantId };
  if (type && TYPES.includes(type)) where.type = type;
  if (funnelStage && STAGES.includes(funnelStage)) where.funnelStage = funnelStage;
  if (templatesOnly) where.isTemplate = true;
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
 * POST (COLLATERAL_MANAGE) — register a brand template or an external asset.
 *
 * Body: { title, category, type, html?, url?, funnelStage?, tags[], slug? }
 *
 * - `html` present → store a Document {html, template:html, data:null} and a
 *   CollateralIndex {isTemplate:true, source:UPLOAD, externalId:document.id}.
 *   This is the primary "brand template" path.
 * - `url` only (no html) → register a non-template external CollateralIndex row
 *   (upserts by slug when a slug is supplied).
 *
 * Validation: title + type required; html OR url required.
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
  const category = body?.category ?? null;
  const funnelStage = body?.funnelStage ?? "ANY";
  const html = typeof body?.html === "string" ? body.html.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (!STAGES.includes(funnelStage)) return NextResponse.json({ error: "invalid_funnelStage" }, { status: 400 });
  if (category && !CATEGORIES.includes(category))
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  if (!html && !url) return NextResponse.json({ error: "html_or_url_required" }, { status: 400 });

  const tags = Array.isArray(body?.tags)
    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const companyHsId = body?.companyHsId ? String(body.companyHsId) : null;
  const dealHsId = body?.dealHsId ? String(body.dealHsId) : null;

  // Brand-template path: persist the pasted markup as a Document, then index it.
  if (html) {
    const document = await prisma.document.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        html,
        template: html,
        data: null,
      },
    });

    const row = await prisma.collateralIndex.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        type,
        category,
        source: "UPLOAD",
        isTemplate: true,
        externalId: document.id,
        funnelStage,
        tags,
        companyHsId,
        dealHsId,
      },
    });

    return NextResponse.json({ item: row, documentId: document.id }, { status: 201 });
  }

  // External-link path: a non-template directory row (upsert by slug if given).
  const data = {
    tenantId: ctx.tenantId,
    title,
    type,
    category,
    source: "UPLOAD",
    isTemplate: false,
    funnelStage,
    tags,
    url: url || null,
    slug: slug || null,
    companyHsId,
    dealHsId,
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
