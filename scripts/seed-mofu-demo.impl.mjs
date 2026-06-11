/**
 * MOFU demo seed (A2) — implementation. Loaded by scripts/seed-mofu-demo.js
 * through vite-node so the `@/` alias + ESM imports below resolve. Idempotent.
 */
import { prisma } from "@/lib/prisma";
import { upsertHubspotOAuth } from "@/lib/assist/mofuIntegration";
import { syncCrmGraph } from "@/lib/assist/syncGraph";
import { recomputeDeal } from "@/lib/assist/intelligence/compute";

const TENANT_NAME = "MOFU Demo";

function log(...args) {
  console.log("[seed-mofu-demo]", ...args);
}

/** 1. Find-or-create the demo tenant; ensure payment_status = true. */
async function ensureTenant() {
  let tenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: TENANT_NAME, payment_status: true },
    });
    log(`created tenant "${TENANT_NAME}" → ${tenant.id}`);
  } else if (!tenant.payment_status) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { payment_status: true },
    });
    log(`tenant "${TENANT_NAME}" exists → ${tenant.id} (enabled payment_status)`);
  } else {
    log(`tenant "${TENANT_NAME}" exists → ${tenant.id}`);
  }
  return tenant;
}

/** 2 + 3. Real-sandbox path: store creds, sync graph, optionally compute. */
async function seedFromHubspot(tenant, token) {
  const portalId = process.env.HUBSPOT_TEST_PORTAL_ID?.trim() || null;

  // Dev-only: store a long-lived bearer token as an OAuth access token for seeding.
  await upsertHubspotOAuth(prisma, tenant.id, {
    accessToken: token,
    refreshToken: null,
    expiresIn: 365 * 24 * 3600,
    portalId,
    scopes: [],
  });
  log(`MofuIntegration upserted via OAuth store (portal ${portalId ?? "n/a"})`);

  log("syncing CRM graph from HubSpot sandbox…");
  const sync = await syncCrmGraph(prisma, tenant.id, token);
  if (!sync.ok) {
    log(`sync failed (${sync.error}). Partial counts:`, sync.counts);
    return { mode: "hubspot", synced: false, counts: sync.counts, computed: [] };
  }
  log("sync counts:", JSON.stringify(sync.counts));

  // 3. Optional LLM compute pass over open deals.
  const computed = [];
  const wantCompute =
    process.env.SEED_COMPUTE === "1" && !!process.env.ANTHROPIC_API_KEY?.trim();
  if (wantCompute) {
    const openDeals = await prisma.deal.findMany({
      where: { tenantId: tenant.id, status: "OPEN" },
      select: { id: true, name: true },
    });
    log(`SEED_COMPUTE=1 → recomputing ${openDeals.length} open deal(s)…`);
    for (const deal of openDeals) {
      try {
        const summary = await recomputeDeal(prisma, tenant.id, deal.id);
        log(
          `  ✓ ${deal.name}: signals=${summary.signals} nbas=${summary.nbas} insight=${summary.insight}` +
            (summary.errors.length ? ` errors=${summary.errors.join("; ")}` : "")
        );
        computed.push({ deal: deal.name, ...summary });
      } catch (err) {
        log(`  ✗ ${deal.name}: compute failed — ${err.message}`);
        computed.push({ deal: deal.name, error: err.message });
      }
    }
  } else {
    log(
      "skipping compute (set SEED_COMPUTE=1 and ANTHROPIC_API_KEY to populate insights)"
    );
  }

  return { mode: "hubspot", synced: true, counts: sync.counts, computed };
}

/** 4. Offline path: build a small synthetic graph directly via prisma (idempotent). */
async function seedSynthetic(tenant) {
  const tenantId = tenant.id;
  const counts = {
    accounts: 0,
    contacts: 0,
    deals: 0,
    dealContacts: 0,
    leads: 0,
    collateral: 0,
  };

  // Company (global, unique by name) + tenant-scoped Account.
  const company = await prisma.company.upsert({
    where: { name: "Northwind Traders" },
    create: {
      name: "Northwind Traders",
      domain: "northwind.example",
      industry: "Logistics",
    },
    update: { domain: "northwind.example", industry: "Logistics" },
  });

  const account = await prisma.account.upsert({
    where: {
      tenantId_hubspotCompanyId: { tenantId, hubspotCompanyId: "synthetic-co-1" },
    },
    create: {
      tenantId,
      companyId: company.id,
      hubspotCompanyId: "synthetic-co-1",
      lifecycleStage: "opportunity",
    },
    update: { companyId: company.id, lifecycleStage: "opportunity" },
  });
  counts.accounts++;

  // BusinessUser (deduped by email) + tenant-scoped Contact.
  async function ensureContact({
    name,
    email,
    jobTitle,
    lifecycleStage,
    persona,
    hubspotContactId,
  }) {
    let bu = await prisma.businessUser.findFirst({ where: { email } });
    if (!bu) {
      bu = await prisma.businessUser.create({
        data: { name, email, jobTitle, companyId: company.id },
      });
    }
    return prisma.contact.upsert({
      where: { tenantId_businessUserId: { tenantId, businessUserId: bu.id } },
      create: { tenantId, businessUserId: bu.id, hubspotContactId, lifecycleStage, persona },
      update: { hubspotContactId, lifecycleStage, persona },
    });
  }

  const champion = await ensureContact({
    name: "Dana Lee",
    email: "dana.lee@northwind.example",
    jobTitle: "VP Operations",
    lifecycleStage: "opportunity",
    persona: "CHAMPION",
    hubspotContactId: "synthetic-contact-1",
  });
  counts.contacts++;

  // Second contact is an MQL lead (no deal link → shows up as a lead).
  await ensureContact({
    name: "Sam Rivera",
    email: "sam.rivera@northwind.example",
    jobTitle: "Procurement Manager",
    lifecycleStage: "marketingqualifiedlead",
    persona: "INFLUENCER",
    hubspotContactId: "synthetic-lead-1",
  });
  counts.leads++;

  // One open Deal + DealContact.
  const deal = await prisma.deal.upsert({
    where: {
      tenantId_hubspotDealId: { tenantId, hubspotDealId: "synthetic-deal-1" },
    },
    create: {
      tenantId,
      accountId: account.id,
      hubspotDealId: "synthetic-deal-1",
      name: "Northwind Traders — Platform Expansion",
      stageLabel: "Qualified to Buy",
      stageBand: "DEAL_EARLY",
      amount: 48000,
      status: "OPEN",
    },
    update: {
      accountId: account.id,
      name: "Northwind Traders — Platform Expansion",
      stageLabel: "Qualified to Buy",
      stageBand: "DEAL_EARLY",
      amount: 48000,
      status: "OPEN",
    },
  });
  counts.deals++;

  await prisma.dealContact.upsert({
    where: { dealId_contactId: { dealId: deal.id, contactId: champion.id } },
    create: { dealId: deal.id, contactId: champion.id, role: "Champion" },
    update: { role: "Champion" },
  });
  counts.dealContacts++;

  // Three CollateralIndex rows (unique by tenantId+slug).
  const collateral = [
    { slug: "northwind-pitch", title: "Northwind Expansion Pitch", type: "PITCH_DECK", funnelStage: "DEAL_EARLY" },
    { slug: "logistics-case-study", title: "Logistics ROI Case Study", type: "CASE_STUDY", funnelStage: "DEAL_LATE" },
    { slug: "platform-one-pager", title: "Platform One-Pager", type: "ONE_PAGER", funnelStage: "LEAD" },
  ];
  for (const c of collateral) {
    await prisma.collateralIndex.upsert({
      where: { tenantId_slug: { tenantId, slug: c.slug } },
      create: { tenantId, source: "GENERATED", ...c },
      update: { title: c.title, type: c.type, funnelStage: c.funnelStage },
    });
    counts.collateral++;
  }

  log("synthetic graph counts:", JSON.stringify(counts));
  return { mode: "synthetic", synced: true, counts, computed: [] };
}

async function main() {
  log(`DB: ${process.env.DATABASE_URL ? "configured" : "MISSING DATABASE_URL"}`);
  const tenant = await ensureTenant();

  const token =
    process.env.HUBSPOT_DEV_ACCESS_TOKEN?.trim() ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  const result = token
    ? await seedFromHubspot(tenant, token)
    : await seedSynthetic(tenant);

  log("──────────── SUMMARY ────────────");
  log(`tenant:  ${tenant.id} (${TENANT_NAME})`);
  log(`mode:    ${result.mode}`);
  log(`counts:  ${JSON.stringify(result.counts)}`);
  if (result.computed?.length) {
    log(`computed: ${JSON.stringify(result.computed)}`);
  }
  log("─────────────────────────────────");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed-mofu-demo] FATAL:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
