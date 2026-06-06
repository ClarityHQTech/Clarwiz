import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getDocument } from "@/lib/mofu/documents";

// GET /api/mofu/documents/:id/html — rendered collateral HTML (for preview / print-to-PDF, D3).
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.MOFU_VIEW });
  if (auth.error) return auth.error;
  const out = await getDocument({ tenantId: auth.ctx.tenantId, documentId: params.id });
  if (!out.ok) return NextResponse.json(out, { status: 404 });
  const html = out.document.renderedHtml || "<p>No rendered content yet.</p>";
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
