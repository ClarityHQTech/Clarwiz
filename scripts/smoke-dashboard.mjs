// Smoke-test getDashboardData (incl. the new internal-domain + account owner filters)
// against the real DB so any invalid Prisma `where` throws here, not silently in the UI.
import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { prisma } = await import("@/lib/prisma");
const { getDashboardData } = await import("@/lib/assist/insightsReader");
const { getTenantInternalDomains } = await import("@/lib/assist/internalDomains");

const tenant = await prisma.tenant.findFirst({ where: { name: "MOFU Demo" } });
const internal = await getTenantInternalDomains(prisma, tenant.id);
console.log("[smoke] internal domains:", internal);

for (const ownerId of [null, "92756177"]) {
  const d = await getDashboardData(prisma, tenant.id, { ownerId });
  console.log(`[smoke] owner=${ownerId ?? "ALL"} → leads=${d.leads.length} deals=${d.deals.length} accounts=${d.accounts.length}`);
}
await prisma.$disconnect();
console.log("[smoke] OK — no Prisma errors");
