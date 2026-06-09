import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { templateToHtml } from "@/lib/assist/collateralGen";
import { renderDocumentHtml } from "@/lib/assist/renderDocument";

/** A stored Document.data is a doc model if it carries a headline or sections. */
function isDocModel(data) {
  return (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (typeof data.headline === "string" || Array.isArray(data.sections) || typeof data.assetType === "string")
  );
}

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
  const html = isDocModel(document.data)
    ? renderDocumentHtml(document.data)
    : document.html && document.html.trim()
      ? document.html
      : templateToHtml(document.template || "");

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always serve the freshest render; the editor cache-busts anyway.
      "Cache-Control": "no-store",
    },
  });
}
