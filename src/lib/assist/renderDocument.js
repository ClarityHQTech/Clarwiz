/**
 * renderDocument — deterministic, beautifully-styled HTML renderer for the
 * structured collateral "doc model" (modeled on the AriyaHR document engine).
 *
 * The LLM emits a structured doc (title/assetType/headline/sections/metrics/cta…)
 * — NOT HTML. This module turns that doc into a single, self-contained, light
 * styled HTML sheet suitable for an iframe `srcdoc`. Because the renderer is
 * deterministic it ALWAYS produces a polished document regardless of how good
 * (or bad) the model's prose is — this is the fix for "renders as raw code".
 *
 * Design system: warm/premium. Serif display headings (Instrument Serif /
 * Georgia), sans body (Inter / system), amber accent #F2A65A, generous padding,
 * print-friendly. No JS, no external deps except a single Google Fonts <link>.
 *
 * The `doc` shape (all fields optional, defensively handled):
 *   { title, assetType, headline, subhead, audience,
 *     sections:[{id,title,body(markdown)}],
 *     metrics:[{label,value,detail}],
 *     cta:{label,detail},
 *     // battlecard:  competitor, capabilities:[{name,us,them}], objections:[{objection,rebuttal}]
 *     // case_study:  challenge, solution, quote:{text,attribution}
 *     // roi_doc:     payback:{summary}
 *     compliance:{score,note} }
 */

const ACCENT = "#F2A65A";

/** HTML-escape a value; non-strings are coerced, null/undefined → "". */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Apply inline markdown (bold/italic/code/links) to an already-escaped string. */
function inlineMd(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Minimal, safe markdown → HTML. Escapes ALL raw HTML first (no injection),
 * then re-introduces a small, fixed set of block + inline constructs:
 * headings (#..######), unordered/ordered lists, GFM tables, paragraphs.
 */
export function mdToHtml(md) {
  if (typeof md !== "string" || !md.trim()) return "";
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const isTableSep = (s) => /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(s);
  const splitRow = (s) =>
    s
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → skip.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(escapeHtml(h[2].trim()))}</h${level}>`);
      i++;
      continue;
    }

    // GFM table: header row + separator row.
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = headers.map((c) => `<th>${inlineMd(escapeHtml(c))}</th>`).join("");
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(escapeHtml(c))}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<table class="md-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`);
      continue;
    }

    // Unordered list.
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(escapeHtml(lines[i].replace(/^\s*[-*+]\s+/, "").trim()))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(escapeHtml(lines[i].replace(/^\s*\d+[.)]\s+/, "").trim()))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-block lines.
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inlineMd(escapeHtml(para.join(" ")))}</p>`);
  }

  return out.join("\n");
}

/* ───────────────────────── section builders ───────────────────────── */

function renderMetrics(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return "";
  const cells = metrics
    .map(
      (m) => `
      <div class="metric">
        <div class="metric-value">${escapeHtml(m?.value)}</div>
        <div class="metric-label">${escapeHtml(m?.label)}</div>
        ${m?.detail ? `<div class="metric-detail">${escapeHtml(m.detail)}</div>` : ""}
      </div>`,
    )
    .join("");
  return `<div class="metrics">${cells}</div>`;
}

function renderSections(sections) {
  if (!Array.isArray(sections)) return "";
  return sections
    .map((s) => {
      const title = s?.title ? `<h2 class="section-title">${escapeHtml(s.title)}</h2>` : "";
      const body = mdToHtml(s?.body);
      if (!title && !body) return "";
      return `<section class="block">${title}<div class="prose">${body}</div></section>`;
    })
    .join("");
}

function renderCta(cta) {
  if (!cta || !cta.label) return "";
  return `
    <section class="cta">
      <div class="cta-label">${escapeHtml(cta.label)}</div>
      ${cta.detail ? `<div class="cta-detail">${escapeHtml(cta.detail)}</div>` : ""}
    </section>`;
}

function renderHero(doc) {
  const headline = doc.headline ? `<h1 class="headline">${escapeHtml(doc.headline)}</h1>` : "";
  const subhead = doc.subhead ? `<p class="subhead">${escapeHtml(doc.subhead)}</p>` : "";
  const eyebrow = doc.audience
    ? `<div class="eyebrow">For ${escapeHtml(doc.audience)}</div>`
    : "";
  if (!headline && !subhead && !eyebrow) return "";
  return `<header class="hero">${eyebrow}${headline}${subhead}</header>`;
}

/* ───────────────────────── per-assetType inner ───────────────────────── */

function innerOnePager(doc) {
  return [renderHero(doc), renderSections(doc.sections), renderMetrics(doc.metrics), renderCta(doc.cta)]
    .filter(Boolean)
    .join("\n");
}

function innerBattlecard(doc) {
  const competitor = doc.competitor ? escapeHtml(doc.competitor) : "Competitor";
  const caps = Array.isArray(doc.capabilities) ? doc.capabilities : [];
  const capTable = caps.length
    ? `<section class="block">
         <h2 class="section-title">Capabilities</h2>
         <table class="vs-table">
           <thead><tr><th>Capability</th><th>Us</th><th>${competitor}</th></tr></thead>
           <tbody>${caps
             .map(
               (c) =>
                 `<tr><td>${escapeHtml(c?.name)}</td><td class="us">${escapeHtml(
                   c?.us,
                 )}</td><td class="them">${escapeHtml(c?.them)}</td></tr>`,
             )
             .join("")}</tbody>
         </table>
       </section>`
    : "";

  const objs = Array.isArray(doc.objections) ? doc.objections : [];
  const objBlock = objs.length
    ? `<section class="block">
         <h2 class="section-title">Objections &amp; rebuttals</h2>
         ${objs
           .map(
             (o) =>
               `<div class="objection">
                  <div class="obj-q">${escapeHtml(o?.objection)}</div>
                  <div class="obj-a">${escapeHtml(o?.rebuttal)}</div>
                </div>`,
           )
           .join("")}
       </section>`
    : "";

  return [renderHero(doc), renderSections(doc.sections), capTable, objBlock, renderCta(doc.cta)]
    .filter(Boolean)
    .join("\n");
}

function innerCaseStudy(doc) {
  const cs = (label, val) =>
    val
      ? `<section class="block"><h2 class="section-title">${label}</h2><div class="prose">${mdToHtml(
          String(val),
        )}</div></section>`
      : "";
  const quote =
    doc.quote && doc.quote.text
      ? `<blockquote class="quote">
           <p>${escapeHtml(doc.quote.text)}</p>
           ${doc.quote.attribution ? `<cite>— ${escapeHtml(doc.quote.attribution)}</cite>` : ""}
         </blockquote>`
      : "";
  return [
    renderHero(doc),
    cs("Challenge", doc.challenge),
    cs("Solution", doc.solution),
    renderSections(doc.sections),
    renderMetrics(doc.metrics),
    quote,
    renderCta(doc.cta),
  ]
    .filter(Boolean)
    .join("\n");
}

function innerRoiDoc(doc) {
  const payback =
    doc.payback && doc.payback.summary
      ? `<section class="cta"><div class="cta-label">Payback</div><div class="cta-detail">${escapeHtml(
          doc.payback.summary,
        )}</div></section>`
      : "";
  return [renderHero(doc), renderMetrics(doc.metrics), renderSections(doc.sections), payback, renderCta(doc.cta)]
    .filter(Boolean)
    .join("\n");
}

function innerEmailTemplate(doc) {
  return [renderHero(doc), renderSections(doc.sections), renderCta(doc.cta)].filter(Boolean).join("\n");
}

const LAYOUTS = {
  one_pager: innerOnePager,
  battlecard: innerBattlecard,
  case_study: innerCaseStudy,
  roi_doc: innerRoiDoc,
  email_template: innerEmailTemplate,
};

/* ───────────────────────── shell ───────────────────────── */

function styles(accent) {
  return `
  :root { --accent: ${accent}; --ink: #1a1714; --muted: #6b625a; --line: #e9e2d8; --bg: #fbf8f3; --card: #ffffff; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--ink);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    line-height: 1.6; -webkit-font-smoothing: antialiased;
  }
  .sheet { max-width: 820px; margin: 0 auto; padding: 56px 56px 72px; }
  .doc-title { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 28px; font-weight: 600; }
  .hero { padding: 0 0 8px; border-bottom: 2px solid var(--accent); margin-bottom: 36px; }
  .eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 12px; }
  .headline {
    font-family: "Instrument Serif", Georgia, "Times New Roman", serif;
    font-size: 46px; line-height: 1.08; font-weight: 400; margin: 0 0 14px; letter-spacing: -0.01em;
  }
  .subhead { font-size: 19px; color: var(--muted); margin: 0 0 22px; max-width: 60ch; }
  .block { margin: 0 0 32px; }
  .section-title {
    font-family: "Instrument Serif", Georgia, serif; font-weight: 400;
    font-size: 26px; margin: 0 0 12px; letter-spacing: -0.01em;
  }
  .prose p { margin: 0 0 12px; }
  .prose h1, .prose h2, .prose h3, .prose h4 { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; line-height: 1.2; margin: 18px 0 8px; }
  .prose ul, .prose ol { margin: 0 0 12px; padding-left: 22px; }
  .prose li { margin: 4px 0; }
  .prose code { background: #f3ede3; padding: 1px 5px; border-radius: 4px; font-size: .92em; }
  .prose a { color: var(--accent); }
  .metrics { display: flex; flex-wrap: wrap; gap: 16px; margin: 8px 0 36px; }
  .metric {
    flex: 1 1 150px; background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; padding: 20px 22px; border-top: 3px solid var(--accent);
  }
  .metric-value { font-family: "Instrument Serif", Georgia, serif; font-size: 32px; line-height: 1; }
  .metric-label { font-size: 13px; color: var(--muted); margin-top: 8px; font-weight: 600; }
  .metric-detail { font-size: 12px; color: var(--muted); margin-top: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; font-size: 14px; }
  table th, table td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; }
  table th { background: #f5efe6; font-weight: 600; }
  .vs-table .us { color: #2f7d50; font-weight: 600; }
  .vs-table .them { color: var(--muted); }
  .objection { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; }
  .obj-q { font-weight: 600; margin-bottom: 6px; }
  .obj-a { color: var(--muted); }
  .obj-a::before { content: "→ "; color: var(--accent); font-weight: 700; }
  .quote { border-left: 3px solid var(--accent); margin: 8px 0 28px; padding: 4px 0 4px 22px; }
  .quote p { font-family: "Instrument Serif", Georgia, serif; font-size: 22px; line-height: 1.35; margin: 0 0 8px; }
  .quote cite { color: var(--muted); font-style: normal; font-size: 14px; }
  .cta { background: var(--ink); color: #fff; border-radius: 16px; padding: 28px 32px; margin-top: 12px; }
  .cta-label { font-family: "Instrument Serif", Georgia, serif; font-size: 24px; color: var(--accent); }
  .cta-detail { font-size: 15px; color: #d8cfc4; margin-top: 6px; }
  @page { size: letter; margin: 0.65in; }
  @media print {
    body { background: #fff; }
    .sheet { max-width: none; padding: 0; }
    .block, .metric, .objection, .cta, .quote { page-break-inside: avoid; }
    .hero { page-break-after: avoid; }
  }
  @media (max-width: 640px) { .sheet { padding: 28px 20px 40px; } .headline { font-size: 34px; } }
  `;
}

/**
 * Render a structured collateral doc model to a complete, styled HTML string.
 *
 * @param {object} doc           The structured doc model (see file header).
 * @param {object} [brand]       Optional brand overrides, e.g. { accent: "#0EA5E9" }.
 * @returns {string}             A self-contained `<!DOCTYPE html>` document.
 */
export function renderDocumentHtml(doc, brand = {}) {
  const d = doc && typeof doc === "object" ? doc : {};
  const accent =
    brand && typeof brand.accent === "string" && brand.accent.trim() ? brand.accent.trim() : ACCENT;
  const assetType = typeof d.assetType === "string" ? d.assetType : "one_pager";
  const layout = LAYOUTS[assetType] || LAYOUTS.one_pager;

  const titleBar = d.title ? `<div class="doc-title">${escapeHtml(d.title)}</div>` : "";
  const inner = layout(d) || `<header class="hero"><h1 class="headline">Collateral</h1></header>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(d.title || "Collateral")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
<style>${styles(accent)}</style>
</head>
<body>
<main class="sheet">
${titleBar}
${inner}
</main>
</body>
</html>`;
}
