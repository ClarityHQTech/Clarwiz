import { templateToHtml } from "@/lib/assist/collateralGen";
import { renderDocumentHtml } from "@/lib/assist/renderDocument";

/** A stored Document.data is a doc model if it carries a headline or sections. */
export function isDocModel(data) {
  return (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (typeof data.headline === "string" || Array.isArray(data.sections) || typeof data.assetType === "string")
  );
}

/** Render a tenant Document row to a complete HTML string (preview, download, email attach). */
export function resolveDocumentHtml(document) {
  if (!document) return "";
  if (isDocModel(document.data)) {
    return renderDocumentHtml(document.data);
  }
  if (document.html && String(document.html).trim()) {
    return document.html;
  }
  return templateToHtml(document.template || "");
}
