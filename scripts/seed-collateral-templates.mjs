// Remove auto-seeded built-in collateral templates for a tenant.
//
// Run:
//   node_modules/.bin/vite-node --config vitest.config.mjs scripts/seed-collateral-templates.mjs
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { prisma } = await import("@/lib/prisma");
const { removeBuiltInCollateralTemplates } = await import("@/lib/assist/builtInCollateralTemplates");

const tenantId = process.env.TENANT_ID?.trim();
const tenant = tenantId
  ? await prisma.tenant.findUnique({ where: { id: tenantId } })
  : await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });

if (!tenant) {
  console.log('[seed] tenant not found — set TENANT_ID or create "MOFU Demo".');
  await prisma.$disconnect();
  process.exit(0);
}

const { removed } = await removeBuiltInCollateralTemplates(prisma, tenant.id);
const total = await prisma.collateralIndex.count({
  where: { tenantId: tenant.id, isTemplate: true },
});

console.log(`[seed] tenant="${tenant.name}" (${tenant.id})`);
console.log(`[seed] removed ${removed} built-in template(s)`);
console.log(`[seed] tenant now has ${total} brand template row(s)`);

await prisma.$disconnect();
