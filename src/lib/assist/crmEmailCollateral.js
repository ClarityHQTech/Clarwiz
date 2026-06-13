import { resolveDocumentHtml } from "@/lib/assist/resolveDocumentHtml";
import { htmlToPdfBuffer } from "@/lib/assist/htmlToPdf";

export function sanitizePdfFilename(title) {
  const base = String(title || "collateral")
    .trim()
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  const name = base || "collateral";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

/**
 * Resolve a CollateralIndex row to a PDF email attachment payload.
 * @returns {Promise<{ filename: string, content: string, mimeType: string, encoding: string, documentId: string } | null>}
 */
export async function loadCollateralPdfAttachment(prisma, tenantId, collateralId) {
  if (!collateralId || !tenantId) return null;

  const index = await prisma.collateralIndex.findFirst({
    where: { id: collateralId, tenantId },
    select: { id: true, title: true, externalId: true },
  });
  if (!index?.externalId) return null;

  const document = await prisma.document.findFirst({
    where: { id: index.externalId, tenantId },
    select: { id: true, title: true, html: true, template: true, data: true },
  });
  if (!document) return null;

  const html = resolveDocumentHtml(document);
  if (!html?.trim()) return null;

  const pdfBuffer = await htmlToPdfBuffer(html);
  const title = index.title || document.title || "collateral";

  return {
    filename: sanitizePdfFilename(title),
    content: pdfBuffer.toString("base64"),
    mimeType: "application/pdf",
    encoding: "base64",
    documentId: document.id,
  };
}

/**
 * Build HTML appendix with PDF download links (HubSpot Single Send has no attachment API).
 */
export function appendCollateralPdfLinks(html, attachments, origin) {
  if (!attachments?.length) return html;
  const base = String(origin || "").replace(/\/$/, "");
  const items = attachments
    .map((att) => {
      const href = `${base}/api/assist/document/${att.documentId}/pdf`;
      const label = att.filename || "Collateral.pdf";
      return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
    })
    .join("");
  return (
    `${html || ""}` +
    `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>` +
    `<p style="font-size:14px;color:#374151;margin:0 0 8px"><strong>Collateral (PDF)</strong></p>` +
    `<ul style="margin:0;padding-left:20px;font-size:14px;color:#374151">${items}</ul>`
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
