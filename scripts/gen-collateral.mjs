// One-off: verify the collateral renderer + generate a real asset for Northwind.
// Run:  node_modules/.bin/vite-node --config vitest.config.mjs scripts/gen-collateral.mjs
import { readFileSync, writeFileSync } from "node:fs";

// Load .env into process.env (DATABASE_URL, ANTHROPIC_API_KEY, SECRET, …).
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { renderDocumentHtml } = await import("@/lib/assist/renderDocument");
const { generateCollateral, assembleCollateralVars, storeGeneratedCollateral } = await import(
  "@/lib/assist/collateralGen"
);
const { prisma } = await import("@/lib/prisma");

// 1) Deterministic renderer — prove it produces a styled document (no LLM).
const sample = {
  title: "Northwind — Analytics Platform one-pager",
  assetType: "one_pager",
  headline: "Cut analytics time-to-insight by 60%",
  subhead: "A unified analytics platform for Northwind Traders' data team.",
  audience: "VP Data",
  sections: [
    { id: "problem", title: "The problem", body: "Reports take **days**. Teams wait on data engineering for every question." },
    { id: "solution", title: "What we do", body: "- Self-serve dashboards\n- Governed semantic layer\n- Live alerts" },
  ],
  metrics: [
    { label: "Time-to-insight", value: "-60%", detail: "vs current stack" },
    { label: "18-mo TCO", value: "$420k", detail: "incl. migration" },
  ],
  cta: { label: "Book a 30-min ROI review", detail: "We'll model your numbers." },
  compliance: { score: "88", note: "On-brand, claims grounded." },
};
const sampleHtml = renderDocumentHtml(sample);
writeFileSync("/tmp/collateral-sample.html", sampleHtml);
console.log("[renderer] sample one-pager →", sampleHtml.length, "chars");
console.log("[renderer] is full HTML doc:", /^<!DOCTYPE html>/i.test(sampleHtml.trim()));
console.log("[renderer] has <style>:", sampleHtml.includes("<style"));
console.log("[renderer] no <script>:", !/<script/i.test(sampleHtml));
console.log("[renderer] contains headline:", sampleHtml.includes("Cut analytics time-to-insight"));
console.log("[renderer] wrote /tmp/collateral-sample.html");

// 2) Real generation for the Northwind deal (needs ANTHROPIC_API_KEY).
const tenant = await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });
const deal = tenant
  ? await prisma.deal.findFirst({ where: { tenantId: tenant.id, name: { contains: "Northwind" } } })
  : null;

if (!tenant || !deal) {
  console.log("[generate] MOFU Demo tenant or Northwind deal not found — skipping live generation.");
} else if (!process.env.ANTHROPIC_API_KEY) {
  console.log("[generate] no ANTHROPIC_API_KEY — skipping live generation.");
} else {
  console.log(`[generate] generating collateral for deal ${deal.name} (${deal.id})…`);
  try {
    const { vars, dealHsId, companyHsId } = await assembleCollateralVars(prisma, tenant.id, {
      dealId: deal.id,
    });
    const generated = await generateCollateral({ vars });
    const { document, collateral } = await storeGeneratedCollateral(prisma, {
      tenantId: tenant.id,
      generated,
      title: generated.title,
      dealHsId,
      companyHsId,
    });
    writeFileSync("/tmp/collateral-northwind.html", document.html ?? renderDocumentHtml(document.data));
    console.log(`[generate] ✓ Document ${document.id} — "${document.title}"`);
    console.log(`[generate]   assetType=${document.data?.assetType} compliance=${JSON.stringify(document.compliance)}`);
    console.log(`[generate]   html ${(document.html ?? "").length} chars → /tmp/collateral-northwind.html`);
    console.log(`[generate]   CollateralIndex row ${collateral?.id} (source=${collateral?.source})`);
    const count = await prisma.collateralIndex.count({ where: { tenantId: tenant.id } });
    console.log(`[generate]   directory now has ${count} collateral row(s)`);
  } catch (e) {
    console.log(`[generate] FAILED: ${e.message}`);
  }
}
await prisma.$disconnect();
