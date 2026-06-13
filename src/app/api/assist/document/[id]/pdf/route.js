import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveDocumentHtml } from "@/lib/assist/resolveDocumentHtml";
import { htmlToPdfBuffer } from "@/lib/assist/htmlToPdf";
import { sanitizePdfFilename } from "@/lib/assist/crmEmailCollateral";

/** GET — download a tenant Document as PDF (used by CRM email collateral links). */
export async function GET(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { title: true, html: true, template: true, data: true },
  });
  if (!document) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  const html = resolveDocumentHtml(document);
  if (!html?.trim()) {
    return NextResponse.json({ error: "empty_document" }, { status: 400 });
  }

  try {
    const pdf = await htmlToPdfBuffer(html);
    const filename = sanitizePdfFilename(document.title);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    if (err?.message === "chrome_not_available") {
      return NextResponse.json({ error: "pdf_renderer_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "pdf_generation_failed" }, { status: 500 });
  }
}
