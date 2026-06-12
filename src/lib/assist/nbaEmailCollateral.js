import { resolveDocumentHtml } from "@/lib/assist/resolveDocumentHtml";
import { ensureRenderableHtmlDocument, extractHtmlBodyForEmbed } from "@/lib/assist/ensureRenderableHtml";
import { stripCollateralViewerLinks } from "@/lib/assist/stripCollateralViewerLinks";

export { stripCollateralViewerLinks };

export function sanitizeAttachmentFilename(title) {
  const base = String(title || "collateral")
    .trim()
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  const name = base || "collateral";
  return name.toLowerCase().endsWith(".html") ? name : `${name}.html`;
}

/**
 * Load a stored Document as an email attachment payload.
 * @returns {Promise<{ filename: string, content: string, mimeType: string } | null>}
 */
export async function loadCollateralEmailAttachment(prisma, tenantId, documentId) {
  if (!documentId || !tenantId) return null;
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
    select: { title: true, html: true, template: true, data: true },
  });
  if (!document) return null;
  const content = ensureRenderableHtmlDocument(resolveDocumentHtml(document));
  if (!content?.trim()) return null;
  return {
    filename: sanitizeAttachmentFilename(document.title),
    content,
    mimeType: "text/html",
  };
}

/**
 * HubSpot Single Send has no attachment API — embed collateral HTML inline below the message.
 */
export function embedCollateralInline(emailHtml, collateralHtml, title) {
  if (!collateralHtml?.trim()) return emailHtml;
  const label = title?.trim() ? title.trim() : "Collateral";
  const bodyMarkup = extractHtmlBodyForEmbed(collateralHtml);
  return (
    `${emailHtml || ""}` +
    `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>` +
    `<p style="font-size:14px;color:#374151;margin:0 0 12px"><strong>${escapeHtml(label)}</strong></p>` +
    bodyMarkup
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
