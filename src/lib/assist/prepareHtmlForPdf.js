import { stripPreviewBannerFromHtml } from "@/lib/assist/richCollateral/previewBanner";

/** Print/PDF CSS — rich templates use 16:9 + overflow:hidden; fine in browser, broken in PDF. */
const PDF_EXPORT_CSS = `
@media print, screen {
  html, body {
    overflow: visible !important;
    height: auto !important;
    min-height: 0 !important;
    background: #fff !important;
  }
  #cw-preview-banner,
  #cw-preview-banner-style,
  #cw-embed-preview-style {
    display: none !important;
  }
  .page, .slide {
    aspect-ratio: auto !important;
    overflow: visible !important;
    min-height: 0 !important;
    height: auto !important;
    max-width: none !important;
    width: 100% !important;
    margin: 0 auto 24px !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    page-break-after: always;
    break-after: page;
  }
  .brochure {
    max-width: none !important;
    grid-template-columns: 1fr !important;
    margin: 0 !important;
    padding: 0 !important;
    gap: 16px !important;
  }
  .panel {
    min-height: 0 !important;
    page-break-after: always;
    break-after: page;
  }
}
`;

/**
 * Normalize collateral HTML for headless Chrome PDF export.
 */
export function prepareHtmlForPdf(html) {
  let out = stripPreviewBannerFromHtml(String(html || ""));
  const style = `<style id="cw-pdf-export">${PDF_EXPORT_CSS}</style>`;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${style}</head>`);
  } else {
    out = style + out;
  }
  return out;
}
