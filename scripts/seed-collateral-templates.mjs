// Seed starter brand templates for the "MOFU Demo" tenant. Each template is a
// Document (its `html` is the on-brand markup) + a CollateralIndex row with
// isTemplate:true, source:UPLOAD. Idempotent: re-running updates the same rows
// (matched by tenantId + title) instead of duplicating them.
//
// Run:
//   node_modules/.bin/vite-node --config vitest.config.mjs scripts/seed-collateral-templates.mjs
import { readFileSync } from "node:fs";

// Load .env into process.env (DATABASE_URL, SECRET, …) — mirrors gen-collateral.mjs.
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { prisma } = await import("@/lib/prisma");

const ACCENT = "#F2A65A";
const INK = "#1F2937";

// Shared <head> styles: serif headings, amber accent, clean self-contained doc.
const head = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { --accent: ${ACCENT}; --ink: ${INK}; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #FAF7F2; color: var(--ink);
    font-family: -apple-system, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.55; -webkit-font-smoothing: antialiased; }
  .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; background: #FFFFFF; }
  h1, h2, h3, .serif { font-family: "Instrument Serif", Georgia, "Times New Roman", serif;
    font-weight: 600; letter-spacing: -0.01em; }
  h1 { font-size: 34px; line-height: 1.15; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 32px 0 12px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px;
    font-weight: 700; color: var(--accent); }
  .rule { height: 3px; width: 56px; background: var(--accent); border-radius: 2px; margin: 14px 0 24px; }
  .lead { font-size: 17px; color: #4B5563; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
  .card { border: 1px solid #EDE7DD; border-radius: 12px; padding: 16px 18px; background: #FFFDFA; }
  .metric { font-size: 26px; }
  .metric b { font-family: "Instrument Serif", Georgia, serif; color: var(--accent); }
  .cta { margin-top: 32px; padding: 20px 22px; border-radius: 14px;
    background: linear-gradient(135deg, rgba(242,166,90,0.16), rgba(242,166,90,0.04));
    border: 1px solid rgba(242,166,90,0.4); }
  .cta a { display: inline-block; margin-top: 10px; padding: 10px 18px; border-radius: 999px;
    background: var(--accent); color: #1F2937; font-weight: 700; text-decoration: none; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #EDE7DD; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; }
  .win { color: #15803D; font-weight: 600; } .watch { color: #B45309; font-weight: 600; }
  .footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #EDE7DD;
    font-size: 12px; color: #9CA3AF; display: flex; justify-content: space-between; }
  ul { padding-left: 20px; } li { margin: 6px 0; }
</style>
</head>`;

// 1) Sales one-pager
const onePager = `${head("{{company_name}} — One-pager")}
<body><div class="page">
  <div class="eyebrow">{{company_name}} for {{prospect_company}}</div>
  <div class="rule"></div>
  <h1>{{prospect_headline}}</h1>
  <p class="lead">{{prospect_subhead}}</p>

  <div class="grid">
    <div class="card"><div class="metric"><b>{{prospect_metric_1_value}}</b></div>{{prospect_metric_1_label}}</div>
    <div class="card"><div class="metric"><b>{{prospect_metric_2_value}}</b></div>{{prospect_metric_2_label}}</div>
  </div>

  <h2>The challenge</h2>
  <p>{{prospect_pain}}</p>

  <h2>How {{company_name}} helps</h2>
  <ul>
    <li>{{prospect_benefit_1}}</li>
    <li>{{prospect_benefit_2}}</li>
    <li>{{prospect_benefit_3}}</li>
  </ul>

  <div class="cta">
    <strong>{{prospect_cta_headline}}</strong>
    <div>{{prospect_cta_detail}}</div>
    <a href="{{prospect_cta_url}}">{{prospect_cta_label}}</a>
  </div>

  <div class="footer"><span>{{company_tagline}}</span><span>{{prospect_owner_name}} · {{prospect_owner_email}}</span></div>
</div></body></html>`;

// 2) Sales battlecard
const battlecard = `${head("{{company_name}} vs {{prospect_competitor}} — Battlecard")}
<body><div class="page">
  <div class="eyebrow">Battlecard · Confidential</div>
  <div class="rule"></div>
  <h1>{{company_name}} vs {{prospect_competitor}}</h1>
  <p class="lead">For {{prospect_company}} · {{prospect_deal_stage}}</p>

  <h2>Why we win</h2>
  <table>
    <thead><tr><th>Dimension</th><th>{{company_name}}</th><th>{{prospect_competitor}}</th></tr></thead>
    <tbody>
      <tr><td>{{compare_dim_1}}</td><td class="win">{{compare_us_1}}</td><td>{{compare_them_1}}</td></tr>
      <tr><td>{{compare_dim_2}}</td><td class="win">{{compare_us_2}}</td><td>{{compare_them_2}}</td></tr>
      <tr><td>{{compare_dim_3}}</td><td class="win">{{compare_us_3}}</td><td>{{compare_them_3}}</td></tr>
    </tbody>
  </table>

  <h2>Objection handling</h2>
  <div class="card"><strong class="watch">“{{objection_1}}”</strong><p>{{rebuttal_1}}</p></div>
  <div class="card" style="margin-top:12px;"><strong class="watch">“{{objection_2}}”</strong><p>{{rebuttal_2}}</p></div>

  <h2>Landmines to set</h2>
  <ul>
    <li>{{landmine_1}}</li>
    <li>{{landmine_2}}</li>
  </ul>

  <div class="footer"><span>{{company_tagline}}</span><span>Owner: {{prospect_owner_name}}</span></div>
</div></body></html>`;

// 3) Marketing case study
const caseStudy = `${head("{{customer_name}} — Case study")}
<body><div class="page">
  <div class="eyebrow">Customer story · {{customer_industry}}</div>
  <div class="rule"></div>
  <h1>How {{customer_name}} {{customer_outcome_short}}</h1>
  <p class="lead">{{customer_summary}}</p>

  <div class="grid">
    <div class="card"><div class="metric"><b>{{result_metric_1_value}}</b></div>{{result_metric_1_label}}</div>
    <div class="card"><div class="metric"><b>{{result_metric_2_value}}</b></div>{{result_metric_2_label}}</div>
  </div>

  <h2>The challenge</h2>
  <p>{{customer_challenge}}</p>

  <h2>The solution</h2>
  <p>{{customer_solution}}</p>

  <h2>The results</h2>
  <ul>
    <li>{{result_bullet_1}}</li>
    <li>{{result_bullet_2}}</li>
    <li>{{result_bullet_3}}</li>
  </ul>

  <div class="cta">
    <strong>“{{customer_quote}}”</strong>
    <div>— {{customer_quote_author}}, {{customer_quote_title}}</div>
  </div>

  <div class="footer"><span>{{company_name}} · {{company_tagline}}</span><span>{{customer_name}}</span></div>
</div></body></html>`;

const TEMPLATES = [
  { title: "Sales One-Pager — Brand Template", type: "ONE_PAGER", category: "SALES",
    funnelStage: "DEAL_EARLY", tags: ["sales", "one-pager", "template"], html: onePager },
  { title: "Competitive Battlecard — Brand Template", type: "BATTLECARD", category: "SALES",
    funnelStage: "DEAL_LATE", tags: ["sales", "battlecard", "competitive", "template"], html: battlecard },
  { title: "Customer Case Study — Brand Template", type: "CASE_STUDY", category: "MARKETING",
    funnelStage: "LEAD", tags: ["marketing", "case-study", "social-proof", "template"], html: caseStudy },
];

const tenant = await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });
if (!tenant) {
  console.log('[seed] "MOFU Demo" tenant not found — nothing seeded.');
  await prisma.$disconnect();
  process.exit(0);
}

let created = 0;
let updated = 0;
for (const t of TEMPLATES) {
  // Find an existing template row (by tenant + title) to stay idempotent.
  const existing = await prisma.collateralIndex.findFirst({
    where: { tenantId: tenant.id, title: t.title, isTemplate: true },
  });

  if (existing) {
    // Refresh the backing Document html (or create one if it was missing).
    if (existing.externalId) {
      await prisma.document.update({
        where: { id: existing.externalId },
        data: { title: t.title, html: t.html, template: t.html, data: null },
      });
    }
    await prisma.collateralIndex.update({
      where: { id: existing.id },
      data: {
        type: t.type, category: t.category, funnelStage: t.funnelStage, tags: t.tags,
        source: "UPLOAD", isTemplate: true,
      },
    });
    updated += 1;
    continue;
  }

  const document = await prisma.document.create({
    data: { tenantId: tenant.id, title: t.title, html: t.html, template: t.html, data: null },
  });
  await prisma.collateralIndex.create({
    data: {
      tenantId: tenant.id, title: t.title, type: t.type, category: t.category,
      source: "UPLOAD", isTemplate: true, externalId: document.id,
      funnelStage: t.funnelStage, tags: t.tags,
    },
  });
  created += 1;
}

const total = await prisma.collateralIndex.count({
  where: { tenantId: tenant.id, isTemplate: true },
});
console.log(`[seed] tenant="MOFU Demo" (${tenant.id})`);
console.log(`[seed] created ${created}, updated ${updated} brand template(s)`);
console.log(`[seed] tenant now has ${total} brand template row(s)`);

await prisma.$disconnect();
