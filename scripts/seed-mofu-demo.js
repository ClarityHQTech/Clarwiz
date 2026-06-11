/**
 * MOFU demo seed (A2) — entrypoint. Idempotent.
 *
 * Run it:  node scripts/seed-mofu-demo.js
 *
 * The actual seed logic lives in scripts/seed-mofu-demo.impl.mjs and imports the
 * shared assist libs, which use the `@/` path alias + ESM. Plain `node` cannot
 * resolve that alias, so this CommonJS entrypoint loads .env and then runs the
 * impl through this repo's vite-node (the same alias resolver vitest uses).
 *
 * What the seed does:
 *   1. Find-or-create the "MOFU Demo" tenant (payment_status = true).
 *   2. If HUBSPOT_DEV_ACCESS_TOKEN is set: upsert the tenant's MofuIntegration
 *      (token encrypted at rest) and hydrate the real sandbox CRM graph via
 *      syncCrmGraph (deal "Northwind Traders", companies/contacts, MQL leads).
 *   3. If SEED_COMPUTE=1 AND ANTHROPIC_API_KEY is set: run recomputeDeal over each
 *      synced OPEN deal to populate DealInsight / Signal / NbaRecommendation
 *      (each deal wrapped in try/catch so one bad LLM call can't sink the seed).
 *   4. If NO HubSpot token: build a small SYNTHETIC graph directly so the
 *      dashboard has content offline.
 *   5. Print a summary and exit 0. Re-running never duplicates rows.
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

// Load .env the same way the rest of the repo does (DATABASE_URL, SECRET,
// HUBSPOT_*, ANTHROPIC_API_KEY, ...). dotenv is a dependency of this repo.
try {
  require(path.join(repoRoot, "node_modules", "dotenv")).config({
    path: path.join(repoRoot, ".env"),
  });
} catch {
  /* dotenv missing → rely on the ambient shell env */
}

const viteNode = path.join(repoRoot, "node_modules", ".bin", "vite-node");
if (!fs.existsSync(viteNode)) {
  console.error("[seed-mofu-demo] vite-node not found — run `npm install` first.");
  process.exit(1);
}

const child = spawnSync(
  viteNode,
  [
    "--config",
    path.join(repoRoot, "vitest.config.mjs"),
    path.join(repoRoot, "scripts", "seed-mofu-demo.impl.mjs"),
  ],
  { stdio: "inherit", cwd: repoRoot, env: { ...process.env } }
);

process.exit(child.status ?? 1);
