import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { listTemplates, createTemplate } from "@/lib/mofu/templates";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const out = await listTemplates({ tenantId: auth.ctx.tenantId });
  return NextResponse.json(out);
}

// POST { title, category: "marketing"|"sales", html, schema? } — upload a template.
export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.COLLATERAL_GENERATE });
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const out = await createTemplate({
    tenantId: auth.ctx.tenantId,
    title: body.title,
    category: body.category ?? "marketing",
    html: body.html,
    schema: body.schema ?? null,
  });
  if (!out.ok) return NextResponse.json(out, { status: 400 });
  return NextResponse.json(out, { status: 201 });
}
