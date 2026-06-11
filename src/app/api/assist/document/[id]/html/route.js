import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveDocumentHtml } from "@/lib/assist/resolveDocumentHtml";

/**
 * GET /api/assist/document/[id]/html — the tenant-scoped Document rendered as a
 * complete, self-contained HTML document, served as `text/html`.
 *
 * This is the live-preview source for the CollateralLiveEditor iframe `srcdoc`
 * (and for direct embedding / "Download HTML"). It returns the stored `html`
 * when present, otherwise wraps the React/Tailwind `template` in a minimal HTML
 * shell via `templateToHtml`. The output is static — no script execution is
 * required to render static collateral.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { html: true, template: true, data: true },
  });
  if (!document) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Prefer a deterministic render of the structured doc model (the source of
  // truth) so the iframe always shows a styled sheet — never raw-ish code.
  // Fall back to stored html, then to the legacy template wrapper.
  const html = resolveDocumentHtml(document);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always serve the freshest render; the editor cache-busts anyway.
      "Cache-Control": "no-store",
    },
  });
}
