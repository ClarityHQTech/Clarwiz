// Verify the pick-template → personalize flow against real data + the seeded templates.
// Run: node_modules/.bin/vite-node --config vitest.config.mjs scripts/verify-personalize.mjs
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { prisma } = await import("@/lib/prisma");
const { assembleProspectContext, personalizeTemplate } = await import("@/lib/assist/collateralGen");
const { rankCollateral } = await import("@/lib/assist/collateralRank");

const tenant = await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });
const deal = await prisma.deal.findFirst({ where: { tenantId: tenant.id, name: { contains: "Northwind" } } });

const templates = await prisma.collateralIndex.findMany({ where: { tenantId: tenant.id, isTemplate: true } });
console.log(`[verify] ${templates.length} library templates:`, templates.map((t) => `${t.category}/${t.type} "${t.title}"`).join(" | "));

const ranked = rankCollateral(templates, {
  funnelStage: deal.stageBand,
  companyHsId: deal.account ? undefined : undefined,
  industry: "logistics",
  type: "BATTLECARD",
  category: "SALES",
});
const best = ranked[0];
console.log(`[verify] best match → "${best.title}" (score ${best.score}, reasons: ${best.reasons?.join("; ")})`);

const tmplDoc = await prisma.document.findFirst({ where: { id: best.externalId } });
const context = await assembleProspectContext(prisma, tenant.id, { dealId: deal.id });
console.log(`[verify] context: seller=${context.seller?.name} prospect=${context.prospect?.name} contacts=${context.contacts?.length} signals=${context.signals?.length}`);

if (!process.env.ANTHROPIC_API_KEY) { console.log("[verify] no ANTHROPIC_API_KEY — skipping personalize"); }
else {
  console.log("[verify] personalizing the template for the prospect…");
  const res = await personalizeTemplate({ templateDoc: tmplDoc, context });
  writeFileSync("/tmp/personalized.html", res.html ?? "");
  console.log(`[verify] ✓ "${res.title}" assetType=${res.data?.assetType} html=${(res.html || "").length} chars → /tmp/personalized.html`);
  console.log(`[verify]   headline: ${res.data?.headline}`);
  console.log(`[verify]   compliance: ${JSON.stringify(res.compliance)}`);
  console.log(`[verify]   mentions prospect "${context.prospect?.name}":`, (res.html || "").includes(context.prospect?.name || "###"));
}
await prisma.$disconnect();
