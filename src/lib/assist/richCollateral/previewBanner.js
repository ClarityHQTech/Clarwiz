export const PREVIEW_BANNER_MESSAGE =
  "Preview only — sample layout with placeholder copy. When NBA creates collateral for a deal, every description and label is hyper-personalized for your tenant and the prospect company.";

const BANNER_STYLE = `
#cw-preview-banner {
  position: sticky;
  top: 0;
  z-index: 99999;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 18px;
  background: linear-gradient(90deg, #3d3528 0%, #5d4a32 100%);
  color: #faf5ec;
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 4px 16px rgba(33, 30, 23, 0.18);
  border-bottom: 2px solid #b9892f;
}
#cw-preview-banner strong {
  display: block;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #e8c56a;
  margin-bottom: 4px;
}
#cw-preview-banner span {
  opacity: 0.95;
}
@media print {
  #cw-preview-banner { display: none !important; }
}
`;

/**
 * Inject a sticky preview disclaimer into rendered collateral HTML.
 */
export function wrapCollateralPreviewHtml(html, { message = PREVIEW_BANNER_MESSAGE } = {}) {
  const banner = `<div id="cw-preview-banner" role="status"><strong>Template preview</strong><span>${escapeHtml(message)}</span></div>`;
  const style = `<style id="cw-preview-banner-style">${BANNER_STYLE}</style>`;

  let out = String(html);
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${style}</head>`);
  } else {
    out = style + out;
  }

  if (/<body[^>]*>/i.test(out)) {
    out = out.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
  } else {
    out = banner + out;
  }

  return out;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
