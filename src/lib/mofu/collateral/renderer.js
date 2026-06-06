// Three-layer renderer (structure / style / content), rebuilt from Pilot's
// render(data, brand) -> HTML pattern. No LLM. Deterministic: same inputs -> same HTML.
import { DEFAULT_BRAND } from "@/lib/mofu/collateral/brand";

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// content layer: never emit a blank token — missing field falls back to a default.
function field(data, key, fallback) {
  const v = data?.[key];
  return v == null || v === "" ? fallback : v;
}

const TEMPLATES = {
  one_pager(data, brand) {
    const headline = esc(field(data, "headline", "How we help"));
    const company = esc(field(data, "clientName", "your team"));
    const subhead = esc(field(data, "subhead", "A tailored overview"));
    const valueProps = Array.isArray(data?.valueProps) && data.valueProps.length
      ? data.valueProps
      : ["Faster execution", "Lower cost", "Better outcomes"];
    const cta = esc(field(data, "cta", "Let's talk"));
    const props = valueProps.map((p) => `<li>${esc(p)}</li>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:${esc(brand.fontFamily)};color:${esc(brand.primaryColor)};margin:0;padding:48px;max-width:720px}
      h1{font-size:32px;margin:0 0 8px} h2{color:${esc(brand.accentColor)};font-weight:600;margin:0 0 24px}
      ul{padding-left:20px} li{margin:8px 0} .cta{display:inline-block;margin-top:24px;background:${esc(brand.accentColor)};color:#fff;padding:12px 20px;border-radius:8px}
      .brand{font-size:12px;color:#888;margin-bottom:24px}
      </style></head><body>
      <div class="brand">${esc(brand.companyName)}</div>
      <h1>${headline}</h1><h2>For ${company} — ${subhead}</h2>
      <ul>${props}</ul><div class="cta">${cta}</div>
      </body></html>`;
  },
};

export function renderTemplate(templateId, data = {}, brand = DEFAULT_BRAND) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`unknown_template_${templateId}`);
  return tpl.render ? tpl.render(data, brand) : tpl(data, brand);
}

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATES);
