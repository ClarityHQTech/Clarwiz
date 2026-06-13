/**
 * CSS injected when collateral HTML is shown inside an editor/viewer iframe.
 * Templates use 16:9 slides and overflow:hidden — fine full-screen, but clipped in a split editor pane.
 */
export const EMBED_PREVIEW_CSS = `
@media screen {
  html, body {
    overflow: auto !important;
    height: auto !important;
    min-height: 100%;
  }
  .page, .slide {
    aspect-ratio: auto !important;
    overflow: visible !important;
    min-height: 0 !important;
    height: auto !important;
    max-width: none !important;
    width: 100% !important;
    margin: 0 auto !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .brochure {
    max-width: none !important;
    grid-template-columns: 1fr !important;
    margin: 0 !important;
    padding: 12px !important;
    gap: 12px !important;
  }
  .panel {
    min-height: 0 !important;
    page-break-after: auto !important;
  }
}
`;

export function injectEmbedPreviewStyles(html) {
  const tag = `<style id="cw-embed-preview">${EMBED_PREVIEW_CSS}</style>`;
  const out = String(html);
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${tag}</head>`);
  return tag + out;
}
