// Seed starter brand templates for the "MOFU Demo" tenant (or pass TENANT_ID).
// Idempotent — delegates to ensureDefaultCollateralTemplates (shared with the
// Collateral Hub page).
//
// Run:
//   node_modules/.bin/vite-node --config vitest.config.mjs scripts/seed-collateral-templates.mjs
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { prisma } = await import("@/lib/prisma");
const { ensureDefaultCollateralTemplates } = await import("@/lib/assist/defaultCollateralTemplates");

const tenantId = process.env.TENANT_ID?.trim();
const tenant = tenantId
  ? await prisma.tenant.findUnique({ where: { id: tenantId } })
  : await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });

if (!tenant) {
  console.log('[seed] tenant not found — set TENANT_ID or create "MOFU Demo".');
  await prisma.$disconnect();
  process.exit(0);
}

const { created, updated } = await ensureDefaultCollateralTemplates(prisma, tenant.id);
const total = await prisma.collateralIndex.count({
  where: { tenantId: tenant.id, isTemplate: true },
});

console.log(`[seed] tenant="${tenant.name}" (${tenant.id})`);
console.log(`[seed] created ${created}, updated ${updated} brand template(s)`);
console.log(`[seed] tenant now has ${total} brand template row(s)`);

await prisma.$disconnect();
