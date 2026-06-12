import { templateToHtml } from "@/lib/assist/collateralGen";
import { renderDocumentHtml } from "@/lib/assist/renderDocument";
import { ensureRenderableHtmlDocument } from "@/lib/assist/ensureRenderableHtml";

/** A stored Document.data is a structured collateral doc model. */
export function isDocModel(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return (
    typeof data.headline === "string" ||
    Array.isArray(data.sections) ||
    typeof data.assetType === "string" ||
    typeof data.title === "string" ||
    Array.isArray(data.metrics) ||
    data.cta != null ||
    Array.isArray(data.capabilities) ||
    Array.isArray(data.objections) ||
    data.challenge != null ||
    data.solution != null
  );
}

function normalizeDocData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data;
}

function parseTemplateJson(template) {
  const raw = typeof template === "string" ? template.trim() : "";
  if (!raw.startsWith("{") && !raw.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizeDocData(parsed);
  } catch {
    return null;
  }
}

function tryRenderDocModel(data, brand = {}) {
  if (!isDocModel(data)) return null;
  return ensureRenderableHtmlDocument(renderDocumentHtml(data, brand));
}

/**
 * Render a tenant Document row to a complete HTML string (preview, download, email attach).
 * Always prefers a deterministic render from the structured doc model when available.
 */
export function resolveDocumentHtml(document, brand = {}) {
  if (!document) return "";

  const fromData = tryRenderDocModel(normalizeDocData(document.data), brand);
  if (fromData) return fromData;

  const fromTemplate = tryRenderDocModel(parseTemplateJson(document.template), brand);
  if (fromTemplate) return fromTemplate;

  if (document.html && String(document.html).trim()) {
    return ensureRenderableHtmlDocument(document.html);
  }

  return ensureRenderableHtmlDocument(templateToHtml(document.template || ""));
}
