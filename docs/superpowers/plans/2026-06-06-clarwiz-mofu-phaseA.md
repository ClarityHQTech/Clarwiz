# Clarwiz MOFU — Phase A (Epic 0 + Epics 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the HubSpot-as-SOR foundation and the MOFU "spine & context" — a deal hydrates from real HubSpot (live volatile fields + cached intel) and a transcript becomes a scored `DealSignal` — through a single `SorAdapter` seam with one additive migration.

**Architecture:** HubSpot is the system of record; Clarwiz stores derived intel only. All SOR access flows through one `SorAdapter` interface with exactly one implementation (`hubspotAdapter`). Volatile fields (stage/owner/amount/timeline) are read live every hydrate and only snapshotted; slow intel is cached on `DealContext.data` with `last_synced_at`. Not-connected → structured no-op (mirrors `src/lib/push/*` `buildSkippedPush`), never throws. New code lives under `src/lib/mofu/`, `src/lib/sor/`, `src/lib/hubspot/`; HubSpot OAuth mirrors the existing Calendly flow.

**Tech Stack:** Next.js 14 (App Router, JS/JSX), Prisma 6 (Postgres), `@/` → `src/`, AES-256-GCM via `encryptSecret.js` (scrypt + per-integration salt), OpenAI + (new) Anthropic for the jury, Vitest for unit tests (new devDep).

---

## Pre-flight (before Task 0)

These are **blocking approvals / inputs** — the kickoff requires asking before adding dependencies, and Epic 0 needs real creds.

- [ ] **Branch:** create `feat/mofu-phase-a` off the current branch (never commit MOFU work to the default branch). Small commits per story id.
- [ ] **Approve new dependencies (kickoff §"Ask me before adding a dependency"):**
  - `@anthropic-ai/sdk` (runtime) — the Anthropic side of the jury (used Phase B; client scaffolded in Phase A is optional, listed here so the one approval covers it).
  - `vitest` (devDep) — repo currently has **no** test runner; PRD §14 mandates unit tests for scoring/gating/adapter mapping.
- [ ] **Inputs to provide (.env, gitignored):** — **Auth = Private App token (PAT)** for Phase A (decided 2026-06-06). OAuth developer-app flow is deferred to multi-tenant productionization.
  - `HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-…` (from sandbox portal → Settings → Integrations → Private Apps; scopes: `crm.objects.deals.read crm.objects.companies.read crm.objects.contacts.read crm.objects.owners.read`)
  - The same **sandbox portal must contain ≥1 Deal** so hydrate/Checkpoint A have real data.
  - `ANTHROPIC_API_KEY` (jury; can land before Phase B)
  - *(Deferred, not needed for Phase A: `HUBSPOT_CLIENT_ID`/`HUBSPOT_CLIENT_SECRET`/`HUBSPOT_REDIRECT_URI` for the OAuth flow.)*
- [ ] **Env loading note:** `next dev` loads `.env`. The MOFU cron dev script (later phases) reuses `SECRET` like `scripts/dev-outreach-cron.js`.

---

## File Structure (created/modified in Phase A)

**Created**
- `prisma/migrations/<ts>_mofu_foundation/migration.sql` — the one additive migration
- `src/lib/sor/SorAdapter.js` — interface contract (JSDoc typedefs) + factory
- `src/lib/sor/hubspotAdapter.js` — the single SOR implementation (HubSpot)
- `src/lib/hubspot/hubspotClient.js` — token-aware fetch w/ retry/backoff + refresh
- `src/lib/hubspot/hubspotIntegration.js` — get/connect/disconnect + token storage
- `src/lib/hubspot/hubspotMappers.js` — HubSpot deal JSON → Clarwiz shape (pure)
- `src/app/api/integrations/hubspot/oauth/start/route.js`
- `src/app/api/integrations/hubspot/oauth/callback/route.js`
- `src/lib/mofu/hydrateDeal.js` — hybrid hydrate (US-1.1)
- `src/lib/mofu/signalScoring.js` — pure deterministic scorer (US-2.1)
- `src/lib/mofu/ingestSignal.js` — dedupe + bound + persist (US-2.1)
- `src/app/api/mofu/deals/[hubspotDealId]/hydrate/route.js` — thin test/exec route
- `vitest.config.js`
- `tests/mofu/signalScoring.test.js`, `tests/mofu/hubspotMappers.test.js`, `tests/mofu/hydrateDeal.test.js`, `tests/mofu/ingestSignal.test.js`, `tests/sor/notConnected.test.js`
- `scripts/checkpoint-a.mjs` — manual end-to-end Checkpoint A

**Modified**
- `prisma/schema.prisma` — add all MOFU models/enums + `Contact.mqlAt`/`Contact.promotedDealId` (additive only)
- `src/lib/encryptSecret.js` — add `encryptHubSpotToken`/`decryptHubSpotToken` (new salt)
- `src/lib/permissions.js` — add MOFU scopes
- `package.json` — add `test`/`test:run` scripts; deps (after approval)
- `.env.example` — document the HubSpot + Anthropic vars

---

## Task 0: The one additive migration (schema spine)

> Rule 8: exactly one additive MOFU migration, no TOFU column dropped/retyped, working down-migration. We add **all** MOFU models now (used across Phases A–D) so there is one migration.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_mofu_foundation/migration.sql` (generated)

- [ ] **Step 1: Add enums + models to `schema.prisma`** (additive; mirror existing conventions — `cuid()`, `tenantId`, selective `@map`)

```prisma
enum SorProvider {
  HUBSPOT
}

enum DealSource {
  TOFU_TRANSITION
  HUBSPOT_MQL
  MANUAL
}

enum InsightScope {
  DEAL
  COMPANY
}

enum DealSignalKind {
  CALL_TRANSCRIPT
  EMAIL
  STAGE_CHANGE
  MEETING
  NOTE
}

enum NbaActionType {
  SEND_EMAIL
  SEND_MARKETING_COLLATERAL
  SEND_SALES_COLLATERAL
  SCHEDULE_MEETING
  CALL_WITH_SCRIPT
  PREP_MEETING
  UPDATE_CRM_CREATE_TASK
  NOTIFY_TEAM
}

enum NbaStatus {
  SUGGESTED
  DRAFTED
  EDITED
  APPROVED
  SENT
  DISMISSED
  FAILED
}

enum CapabilityKind {
  NOTE_TAKER
  CALLING
  EMAIL
  MEETING_SCHEDULER
}

enum DocumentType {
  MARKETING_COLLATERAL
  SALES_COLLATERAL
  BATTLECARD
  EMAIL_ATTACHMENT
}

enum DocumentPath {
  A
  B
}

enum DocumentStatus {
  DRAFT
  READY
  SENT
}

model HubSpotIntegration {
  id                     String   @id @default(cuid())
  tenantId               String   @unique
  tenant                 Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  portalId               String?
  encryptedAccessToken   String?
  encryptedRefreshToken  String?
  tokenExpiresAt         DateTime?
  scopes                 String[] @default([])
  status                 String   @default("pending") // pending | connected | error
  lastError              String?
  connectedAt            DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

model Deal {
  id                     String     @id @default(cuid())
  tenantId               String
  tenant                 Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  hubspotDealId          String     @map("hubspot_deal_id")
  name                   String?
  cachedStage            String?    @map("cached_stage")
  cachedOwner            String?    @map("cached_owner")
  cachedAmount           Decimal?   @map("cached_amount")
  cachedCurrency         String?    @map("cached_currency")
  stageSnapshotAt        DateTime?  @map("stage_snapshot_at")
  originContactCampaignId String?   @map("origin_contact_campaign_id")
  source                 DealSource @default(MANUAL)
  autopilot              Boolean    @default(false)
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt
  context                DealContext?
  signals                DealSignal[]
  insights               DealInsight[]
  recommendations        NbaRecommendation[]
  documents              Document[]

  @@unique([tenantId, hubspotDealId])
  @@index([tenantId])
}

model DealContext {
  id           String   @id @default(cuid())
  tenantId     String
  dealId       String   @unique
  deal         Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  data         Json
  sourceRefs   Json?    @map("source_refs")
  lastSyncedAt DateTime @map("last_synced_at")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([tenantId])
}

model DealSignal {
  id                 String         @id @default(cuid())
  tenantId           String
  dealId             String
  deal               Deal           @relation(fields: [dealId], references: [id], onDelete: Cascade)
  scope              InsightScope   @default(DEAL)
  kind               DealSignalKind
  source             String
  externalId         String         @map("external_id")
  summary            String?
  score              Float          @default(0)
  signalReferenceId  String         @map("signal_reference_id")
  occurredAt         DateTime?      @map("occurred_at")
  raw                Json?
  processedForNbaAt  DateTime?      @map("processed_for_nba_at")
  createdAt          DateTime       @default(now())

  @@unique([tenantId, source, kind, externalId])
  @@index([tenantId, dealId])
}

model DealInsight {
  id                        String       @id @default(cuid())
  tenantId                  String
  scope                     InsightScope
  dealId                    String?
  deal                      Deal?        @relation(fields: [dealId], references: [id], onDelete: Cascade)
  companyId                 String?      @map("company_id")
  executiveSummary          Json?        @map("executive_summary")
  stakeholderIntelligence   Json?        @map("stakeholder_intelligence")
  valueIntelligence         Json?        @map("value_intelligence")
  riskIntelligence          Json?        @map("risk_intelligence")
  temporalIntelligence      Json?        @map("temporal_intelligence")
  competitiveIntelligence   Json?        @map("competitive_intelligence")
  expansionIntelligence     Json?        @map("expansion_intelligence")
  actionableRecommendations Json?        @map("actionable_recommendations")
  systemMetadata            Json?        @map("system_metadata")
  modelUsed                 String?      @map("model_used")
  providerUsage             Json?        @map("provider_usage")
  providerCost              Json?        @map("provider_cost")
  createdAt                 DateTime     @default(now())

  @@index([tenantId, dealId])
  @@index([tenantId, companyId])
}

model TenantCapability {
  id           String         @id @default(cuid())
  tenantId     String
  capability   CapabilityKind
  present      Boolean        @default(false)
  detail       Json?
  discoveredAt DateTime       @default(now()) @map("discovered_at")

  @@unique([tenantId, capability])
  @@index([tenantId])
}

model NbaTemplate {
  id                   String        @id @default(cuid())
  tenantId             String?
  actionType           NbaActionType @map("action_type")
  title                String
  collateralTemplateId String?       @map("collateral_template_id")
  promptScaffold       String?       @map("prompt_scaffold")
  guardrails           Json?
  enabled              Boolean       @default(true)
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([tenantId])
}

model NbaRecommendation {
  id                  String        @id @default(cuid())
  tenantId            String
  dealId              String
  deal                Deal          @relation(fields: [dealId], references: [id], onDelete: Cascade)
  scope               InsightScope  @default(DEAL)
  actionType          NbaActionType @map("action_type")
  title               String
  score               Float         @default(0)
  signalReferenceId   String?       @map("signal_reference_id")
  payload             Json?
  templateId          String?       @map("template_id")
  status              NbaStatus     @default(SUGGESTED)
  juryResult          Json?         @map("jury_result")
  modelUsed           String?       @map("model_used")
  providerUsage       Json?         @map("provider_usage")
  providerCost        Json?         @map("provider_cost")
  executedAt          DateTime?     @map("executed_at")
  hubspotEngagementId String?       @map("hubspot_engagement_id")
  createdAt           DateTime      @default(now())

  @@index([tenantId, dealId])
}

model Document {
  id                  String         @id @default(cuid())
  tenantId            String
  dealId              String
  deal                Deal           @relation(fields: [dealId], references: [id], onDelete: Cascade)
  nbaRecommendationId String?        @map("nba_recommendation_id")
  type                DocumentType
  path                DocumentPath
  contentJson         Json?          @map("content_json")
  renderedHtml        String?        @map("rendered_html")
  pdfUrl              String?        @map("pdf_url")
  brand               Json?
  version             Int            @default(1)
  status              DocumentStatus @default(DRAFT)
  modelUsed           String?        @map("model_used")
  providerUsage       Json?          @map("provider_usage")
  providerCost        Json?          @map("provider_cost")
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@index([tenantId, dealId])
}
```

- [ ] **Step 2: Add additive fields to existing `Contact` model** (handoff markers — do not retype existing columns)

```prisma
// inside model Contact { ... }  (additions only)
  mqlAt           DateTime? @map("mql_at")
  promotedDealId  String?   @map("promoted_deal_id")
```

- [ ] **Step 3: Add the back-relations on `Tenant`** (additive — Prisma requires the inverse side). Add to `model Tenant`:

```prisma
  hubspotIntegration HubSpotIntegration?
  deals              Deal[]
```

- [ ] **Step 4: Generate the migration WITHOUT applying to prod**

Run: `npx prisma migrate dev --name mofu_foundation --create-only`
Expected: a new folder `prisma/migrations/<ts>_mofu_foundation/migration.sql` containing only `CREATE TABLE`/`CREATE TYPE`/`ALTER TABLE ... ADD COLUMN` (no `DROP`/`ALTER COLUMN TYPE` on TOFU tables).

- [ ] **Step 5: Review the SQL is purely additive**

Run: `grep -Ei 'DROP |ALTER COLUMN|DROP COLUMN' prisma/migrations/*mofu_foundation/migration.sql`
Expected: no output (empty). If anything prints, STOP — the change isn't additive.

- [ ] **Step 6: Apply to the LOCAL dev DB only**

Run: `npx prisma migrate dev` (against local `clarwiz`; never Neon prod)
Expected: "migration applied", `prisma generate` runs.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(mofu): additive migration — deal/insight/nba/document spine (US-1.1, US-2.1)"
```

---

## Task 1: HubSpot token encryption helpers

**Files:**
- Modify: `src/lib/encryptSecret.js`
- Test: `tests/mofu/encryptHubSpot.test.js`

- [ ] **Step 1: Set up Vitest** (one-time; after dependency approval)

Create `vitest.config.js`:
```js
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: { environment: "node", include: ["tests/**/*.test.js"] },
});
```
Add to `package.json` scripts: `"test": "vitest", "test:run": "vitest run"`.

- [ ] **Step 2: Write the failing test**

```js
// tests/mofu/encryptHubSpot.test.js
import { describe, it, expect, beforeAll } from "vitest";
import { encryptHubSpotToken, decryptHubSpotToken } from "@/lib/encryptSecret";

beforeAll(() => { process.env.SECRET = process.env.SECRET || "test_secret_value_for_unit_tests"; });

describe("HubSpot token crypto", () => {
  it("round-trips a token", () => {
    const token = "CJ-abc.123-refresh_or_access";
    const enc = encryptHubSpotToken(token);
    expect(enc).not.toContain(token);
    expect(decryptHubSpotToken(enc)).toBe(token);
  });
  it("returns null for empty input", () => {
    expect(encryptHubSpotToken("")).toBeNull();
    expect(decryptHubSpotToken(null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:run -- tests/mofu/encryptHubSpot.test.js`
Expected: FAIL — `encryptHubSpotToken is not a function`.

- [ ] **Step 4: Implement (mirror the existing Calendly helpers + add a new salt)**

Open `src/lib/encryptSecret.js`, find the existing `encryptCalendlyToken`/`decryptCalendlyToken` pair and its salt constant. Add alongside them, reusing the same internal encrypt/decrypt primitives:
```js
const SCRYPT_SALT_HUBSPOT = "clarwiz:hubspot:v1";

export function encryptHubSpotToken(plainText) {
  if (!plainText) return null;
  return encryptWithSalt(plainText, SCRYPT_SALT_HUBSPOT); // use the same internal helper the Calendly fns call
}
export function decryptHubSpotToken(stored) {
  if (!stored) return null;
  return decryptWithSalt(stored, SCRYPT_SALT_HUBSPOT);
}
```
> Note: match the EXACT internal helper names used by `encryptCalendlyToken` in this file (open it first). The salt string just needs to be unique and stable.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- tests/mofu/encryptHubSpot.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/encryptSecret.js tests/mofu/encryptHubSpot.test.js vitest.config.js package.json
git commit -m "feat(mofu): hubspot token encryption helpers + vitest setup"
```

---

## Task 2: HubSpot integration store (PAT) + connect

> **Phase A uses a Private App token (PAT).** The store accepts a static PAT (no refresh, no expiry). The `connectHubSpotFromOAuth` helper + OAuth routes are written here too but only as the **deferred** multi-tenant path — they are NOT exercised in Phase A. The adapter/client only ever read `decryptHubSpotToken(integration.encryptedAccessToken)`, so swapping PAT→OAuth later changes nothing downstream.

**Files:**
- Create: `src/lib/hubspot/hubspotIntegration.js`
- Create: `src/app/api/integrations/hubspot/pat/route.js` (POST a PAT → store; tenant-scoped, `CHANNEL_INTEGRATE`)
- Test: `tests/mofu/hubspotIntegration.test.js`
- Modify: `.env.example`
- *(Deferred, write but don't wire: `src/app/api/integrations/hubspot/oauth/{start,callback}/route.js`)*

- [ ] **Step 1: Write the failing test** (PAT store round-trip + connected check, injected prisma):

```js
// tests/mofu/hubspotIntegration.test.js
import { describe, it, expect, vi, beforeAll } from "vitest";
import { connectHubSpotFromPat, isHubSpotConnected } from "@/lib/hubspot/hubspotIntegration";

beforeAll(() => { process.env.SECRET = process.env.SECRET || "test_secret_value_for_unit_tests"; });

it("stores a PAT encrypted and reports connected", async () => {
  let saved;
  const prisma = { hubSpotIntegration: { upsert: vi.fn(async (a) => { saved = { ...a.create }; return saved; }) } };
  const row = await connectHubSpotFromPat("t1", "pat-na1-abc", { prisma, portalId: "242" });
  expect(saved.encryptedAccessToken).not.toContain("pat-na1-abc"); // encrypted at rest
  expect(isHubSpotConnected(row)).toBe(true);
});
it("blank token → not connected", () => {
  expect(isHubSpotConnected({ status: "pending", encryptedAccessToken: null })).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL** (`connectHubSpotFromPat is not a function`).

- [ ] **Step 3: Implement the store** `src/lib/hubspot/hubspotIntegration.js`

```js
import { prisma as defaultPrisma } from "@/lib/prisma";
import { encryptHubSpotToken, decryptHubSpotToken } from "@/lib/encryptSecret";

const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

export async function getHubSpotIntegration(tenantId, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  return prisma.hubSpotIntegration.findUnique({ where: { tenantId } });
}

export function isHubSpotConnected(integration) {
  return !!integration && integration.status === "connected" && !!integration.encryptedAccessToken;
}

/** Phase A path: store a Private App token (static, no refresh). */
export async function connectHubSpotFromPat(tenantId, pat, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  if (!pat || !pat.trim()) throw new Error("hubspot_pat_required");
  const data = {
    tenantId,
    portalId: deps.portalId ?? null,
    encryptedAccessToken: encryptHubSpotToken(pat.trim()),
    encryptedRefreshToken: null,
    tokenExpiresAt: null,
    scopes: (process.env.HUBSPOT_SCOPES || "").split(/\s+/).filter(Boolean),
    status: "connected",
    lastError: null,
    connectedAt: new Date(),
  };
  return prisma.hubSpotIntegration.upsert({ where: { tenantId }, create: data, update: data });
}

/** DEFERRED (multi-tenant): OAuth code exchange. Not used in Phase A. */
export async function connectHubSpotFromOAuth(tenantId, code, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    code,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`hubspot_token_exchange_failed_${res.status}`);
  const tok = await res.json(); // { access_token, refresh_token, expires_in }
  const data = {
    tenantId,
    encryptedAccessToken: encryptHubSpotToken(tok.access_token),
    encryptedRefreshToken: encryptHubSpotToken(tok.refresh_token),
    tokenExpiresAt: new Date(Date.now() + (tok.expires_in ?? 1800) * 1000),
    scopes: (process.env.HUBSPOT_SCOPES || "").split(/\s+/).filter(Boolean),
    status: "connected",
    lastError: null,
    connectedAt: new Date(),
  };
  return prisma.hubSpotIntegration.upsert({ where: { tenantId }, create: data, update: data });
}

export { decryptHubSpotToken };
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Implement the PAT connect route** `src/app/api/integrations/hubspot/pat/route.js` (mirror `src/app/api/campaigns/route.js` auth):

```js
import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { connectHubSpotFromPat } from "@/lib/hubspot/hubspotIntegration";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body?.token?.trim()) return NextResponse.json({ error: "token is required" }, { status: 400 });
  const row = await connectHubSpotFromPat(auth.ctx.tenantId, body.token, { portalId: body.portalId ?? null });
  return NextResponse.json({ ok: true, status: row.status, portalId: row.portalId });
}
```

- [ ] **Step 6: Document env vars** in `.env.example` (the Pre-flight list — PAT + Anthropic; mark OAuth vars deferred).

- [ ] **Step 7: Manual verify (needs your PAT)** — `POST /api/integrations/hubspot/pat` with `{ "token": "pat-na1-…" }` (or a one-off seed) → `HubSpotIntegration` row `status=connected`.

- [ ] **Step 8: Commit** `feat(mofu): hubspot private-app token store + connect route (oauth deferred)`

---

## Task 3: HubSpot client with retry/backoff + refresh

**Files:**
- Create: `src/lib/hubspot/hubspotClient.js`
- Test: `tests/mofu/hubspotClient.test.js`

- [ ] **Step 1: Write the failing test** (retry on 429/5xx with injected fetch; refresh on 401)

```js
// tests/mofu/hubspotClient.test.js
import { describe, it, expect, vi } from "vitest";
import { hubspotFetch } from "@/lib/hubspot/hubspotClient";

function resp(status, json) {
  return { ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) };
}

describe("hubspotFetch", () => {
  it("retries on 500 then succeeds (max 3, exp backoff)", async () => {
    const calls = [resp(500, {}), resp(500, {}), resp(200, { id: "d1" })];
    const fakeFetch = vi.fn(async () => calls.shift());
    const out = await hubspotFetch("/crm/v3/objects/deals/d1", { accessToken: "t", fetchImpl: fakeFetch, sleep: async () => {} });
    expect(out).toEqual({ id: "d1" });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });
  it("gives up after 3 failures and throws structured error", async () => {
    const fakeFetch = vi.fn(async () => resp(503, {}));
    await expect(hubspotFetch("/x", { accessToken: "t", fetchImpl: fakeFetch, sleep: async () => {} }))
      .rejects.toMatchObject({ code: "hubspot_unavailable" });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`hubspotFetch is not a function`).

- [ ] **Step 3: Implement** `src/lib/hubspot/hubspotClient.js`

```js
const BASE = "https://api.hubapi.com";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function hubspotFetch(path, { accessToken, method = "GET", body, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxAttempts = 3 } = {}) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status) || attempt === maxAttempts) break;
    await sleep(200 * 2 ** (attempt - 1)); // 200, 400
  }
  const err = new Error(`hubspot_request_failed_${lastStatus}`);
  err.code = lastStatus === 429 ? "hubspot_rate_limited" : "hubspot_unavailable";
  err.status = lastStatus;
  throw err;
}
```
> Token refresh (401 → use refresh_token → persist) wraps this in `hubspotIntegration.js` as `withFreshToken(tenantId, fn)`; add it here once the connect flow is verified. Keep `hubspotFetch` pure/injectable so it stays unit-testable.

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(mofu): hubspot client with retry/backoff`

---

## Task 4: SorAdapter seam + HubSpot mapping

**Files:**
- Create: `src/lib/sor/SorAdapter.js`, `src/lib/sor/hubspotAdapter.js`, `src/lib/hubspot/hubspotMappers.js`
- Test: `tests/mofu/hubspotMappers.test.js`, `tests/sor/notConnected.test.js`

- [ ] **Step 1: Define the interface contract** `src/lib/sor/SorAdapter.js`

```js
/**
 * @typedef {Object} LiveDealFields
 * @property {string} stage  @property {string|null} owner
 * @property {number|null} amount  @property {string|null} currency
 * @property {Array<{kind:string, occurredAt:string, summary?:string, externalId:string}>} timeline
 *
 * @typedef {Object} SorDeal
 * @property {string} hubspotDealId  @property {string|null} name
 * @property {LiveDealFields} live  @property {Object} raw
 *
 * SorAdapter contract (HubSpot is the ONLY impl in v1):
 *   getDeal(tenantId, hubspotDealId): Promise<{ ok:true, deal:SorDeal } | { ok:false, reason:string }>
 *   getDealEngagements(tenantId, hubspotDealId): Promise<{ ok:true, items:[] } | { ok:false, reason:string }>
 */
import { hubspotAdapter } from "@/lib/sor/hubspotAdapter";
export function getSorAdapter(/* tenant */) { return hubspotAdapter; } // single impl; do NOT add a second
```

- [ ] **Step 2: Write failing tests**

```js
// tests/mofu/hubspotMappers.test.js
import { describe, it, expect } from "vitest";
import { mapHubSpotDeal } from "@/lib/hubspot/hubspotMappers";

it("maps HubSpot deal JSON to live fields", () => {
  const hs = { id: "d1", properties: { dealname: "Acme", dealstage: "qualifiedtobuy", hubspot_owner_id: "55", amount: "12000", deal_currency_code: "USD" } };
  const out = mapHubSpotDeal(hs);
  expect(out).toMatchObject({ hubspotDealId: "d1", name: "Acme", live: { stage: "qualifiedtobuy", owner: "55", amount: 12000, currency: "USD" } });
});
it("tolerates missing optional props without throwing", () => {
  const out = mapHubSpotDeal({ id: "d2", properties: {} });
  expect(out.live).toMatchObject({ stage: null, owner: null, amount: null, currency: null });
});
```

```js
// tests/sor/notConnected.test.js
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/hubspot/hubspotIntegration", () => ({
  getHubSpotIntegration: async () => null,
  isHubSpotConnected: () => false,
}));
import { hubspotAdapter } from "@/lib/sor/hubspotAdapter";

it("returns structured no-op when HubSpot is not connected (never throws)", async () => {
  const out = await hubspotAdapter.getDeal("tenant_x", "d1");
  expect(out).toEqual({ ok: false, reason: "sor_not_connected" });
});
```

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Implement mappers** `src/lib/hubspot/hubspotMappers.js`

```js
export function mapHubSpotDeal(hs) {
  const p = hs?.properties ?? {};
  const amount = p.amount != null && p.amount !== "" ? Number(p.amount) : null;
  return {
    hubspotDealId: String(hs?.id),
    name: p.dealname ?? null,
    live: {
      stage: p.dealstage ?? null,
      owner: p.hubspot_owner_id ?? null,
      amount: Number.isFinite(amount) ? amount : null,
      currency: p.deal_currency_code ?? null,
      timeline: [],
    },
    raw: hs ?? {},
  };
}
```

- [ ] **Step 5: Implement the adapter** `src/lib/sor/hubspotAdapter.js`

```js
import { getHubSpotIntegration, isHubSpotConnected, decryptHubSpotToken } from "@/lib/hubspot/hubspotIntegration";
import { hubspotFetch } from "@/lib/hubspot/hubspotClient";
import { mapHubSpotDeal } from "@/lib/hubspot/hubspotMappers";

const DEAL_PROPS = ["dealname", "dealstage", "hubspot_owner_id", "amount", "deal_currency_code"];

export const hubspotAdapter = {
  async getDeal(tenantId, hubspotDealId) {
    const integ = await getHubSpotIntegration(tenantId);
    if (!isHubSpotConnected(integ)) return { ok: false, reason: "sor_not_connected" };
    const accessToken = decryptHubSpotToken(integ.encryptedAccessToken);
    try {
      const json = await hubspotFetch(`/crm/v3/objects/deals/${hubspotDealId}?properties=${DEAL_PROPS.join(",")}`, { accessToken });
      return { ok: true, deal: mapHubSpotDeal(json) };
    } catch (err) {
      return { ok: false, reason: err.code || "hubspot_error", status: err.status };
    }
  },
  async getDealEngagements(tenantId, hubspotDealId) {
    const integ = await getHubSpotIntegration(tenantId);
    if (!isHubSpotConnected(integ)) return { ok: false, reason: "sor_not_connected" };
    return { ok: true, items: [] }; // expanded in Epic 2 ingestion + Phase D webhooks
  },
};
```

- [ ] **Step 6: Run → PASS.**  - [ ] **Step 7: Commit** `feat(mofu): SorAdapter seam + hubspot mapping (US-1.1)`

---

## Task 5: Hybrid hydrate (US-1.1)

**Files:**
- Create: `src/lib/mofu/hydrateDeal.js`
- Test: `tests/mofu/hydrateDeal.test.js`

**Behavior contract (from US-1.1):** first hydrate creates `Deal` pointer + `DealContext`; live fields come from the adapter every call; slow intel re-pulled only when stale (`STALE_MS`); adapter `{ok:false, reason:'sor_not_connected'}` → return `{ ok:false, reason:'sor_not_connected' }` (connect CTA), never throw; adapter error after retries → return last cached context + `warning:'stale_context'`, brain can still run. `cachedStage`/etc. are written only as a snapshot, never read as authoritative.

- [ ] **Step 1: Write failing tests** (inject a fake adapter + prisma):

```js
// tests/mofu/hydrateDeal.test.js
import { describe, it, expect, vi } from "vitest";
import { hydrateDeal } from "@/lib/mofu/hydrateDeal";

function fakeDeps({ adapterResult, existingContext = null }) {
  const deal = { id: "deal_1", tenantId: "t1", hubspotDealId: "d1" };
  const prisma = {
    deal: { upsert: vi.fn(async () => deal), update: vi.fn(async () => deal) },
    dealContext: { findUnique: vi.fn(async () => existingContext), upsert: vi.fn(async (a) => ({ id: "ctx_1", ...a.create })) },
  };
  const adapter = { getDeal: vi.fn(async () => adapterResult), getDealEngagements: vi.fn(async () => ({ ok: true, items: [] })) };
  return { prisma, adapter, deal };
}

it("not connected → structured no-op, no throw", async () => {
  const { prisma, adapter } = fakeDeps({ adapterResult: { ok: false, reason: "sor_not_connected" } });
  const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
  expect(out).toMatchObject({ ok: false, reason: "sor_not_connected" });
});

it("happy path returns live fields + creates pointer/context", async () => {
  const { prisma, adapter } = fakeDeps({ adapterResult: { ok: true, deal: { hubspotDealId: "d1", name: "Acme", live: { stage: "qualifiedtobuy", owner: "55", amount: 12000, currency: "USD", timeline: [] }, raw: {} } } });
  const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
  expect(out.ok).toBe(true);
  expect(out.context.live.stage).toBe("qualifiedtobuy");
  expect(prisma.deal.upsert).toHaveBeenCalled();
  expect(prisma.dealContext.upsert).toHaveBeenCalled();
});

it("adapter hard-error with existing context → stale_context warning, brain still runs", async () => {
  const { prisma, adapter } = fakeDeps({ adapterResult: { ok: false, reason: "hubspot_unavailable" }, existingContext: { dealId: "deal_1", data: { cached: { foo: 1 } }, lastSyncedAt: new Date() } });
  prisma.deal.upsert = vi.fn(async () => ({ id: "deal_1", tenantId: "t1", hubspotDealId: "d1" }));
  const out = await hydrateDeal({ tenantId: "t1", hubspotDealId: "d1" }, { prisma, adapter });
  expect(out.ok).toBe(true);
  expect(out.warning).toBe("stale_context");
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/mofu/hydrateDeal.js`

```js
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getSorAdapter } from "@/lib/sor/SorAdapter";

const STALE_MS = 1000 * 60 * 30; // 30 min slow-intel freshness

export async function hydrateDeal({ tenantId, hubspotDealId }, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const adapter = deps.adapter ?? getSorAdapter();

  const result = await adapter.getDeal(tenantId, hubspotDealId);

  // Not connected → connect CTA, no pointer side effects
  if (!result.ok && result.reason === "sor_not_connected") {
    return { ok: false, reason: "sor_not_connected" };
  }

  // Ensure pointer exists (so we can fall back to cache on hard errors)
  const deal = await prisma.deal.upsert({
    where: { tenantId_hubspotDealId: { tenantId, hubspotDealId } },
    create: { tenantId, hubspotDealId, source: "HUBSPOT_MQL" },
    update: {},
  });

  if (!result.ok) {
    // Hard error after retries → last cached context + warning
    const existing = await prisma.dealContext.findUnique({ where: { dealId: deal.id } });
    if (existing) {
      return { ok: true, dealId: deal.id, warning: "stale_context", context: { live: null, cached: existing.data?.cached ?? {} }, lastSyncedAt: existing.lastSyncedAt };
    }
    return { ok: false, reason: result.reason };
  }

  const live = result.deal.live;
  // Snapshot volatile fields (NEVER read as authoritative for decisions)
  await prisma.deal.update({
    where: { id: deal.id },
    data: { name: result.deal.name ?? undefined, cachedStage: live.stage, cachedOwner: live.owner, cachedAmount: live.amount ?? undefined, cachedCurrency: live.currency, stageSnapshotAt: new Date() },
  });

  // Refresh slow intel only when stale
  const existing = await prisma.dealContext.findUnique({ where: { dealId: deal.id } });
  const isStale = !existing || (Date.now() - new Date(existing.lastSyncedAt).getTime()) > STALE_MS;
  let cached = existing?.data?.cached ?? {};
  if (isStale) {
    const eng = await adapter.getDealEngagements(tenantId, hubspotDealId);
    cached = { ...cached, engagements: eng.ok ? eng.items : (cached.engagements ?? []) };
    await prisma.dealContext.upsert({
      where: { dealId: deal.id },
      create: { tenantId, dealId: deal.id, data: { cached }, lastSyncedAt: new Date() },
      update: { data: { cached }, lastSyncedAt: new Date() },
    });
  }

  return { ok: true, dealId: deal.id, context: { live, cached }, lastSyncedAt: new Date() };
}
```

- [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** `feat(mofu): hybrid hydrate deal context (US-1.1)`

---

## Task 6: Hydrate API route (tenant-scoped, RBAC)

**Files:**
- Create: `src/app/api/mofu/deals/[hubspotDealId]/hydrate/route.js`
- Modify: `src/lib/permissions.js`

- [ ] **Step 1: Add MOFU scopes** to `PERMISSIONS` in `src/lib/permissions.js` (additive):

```js
  MOFU_VIEW: "mofu:view",
  DEAL_READ: "deal:read",
  NBA_RUN: "nba:run",
  NBA_APPROVE: "nba:approve",
  COLLATERAL_GENERATE: "collateral:generate",
  OPERATOR_DASHBOARD: "operator:dashboard",
```

- [ ] **Step 2: Implement the route** (mirror `src/app/api/campaigns/route.js`):

```js
import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { hydrateDeal } from "@/lib/mofu/hydrateDeal";

export async function POST(_req, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.DEAL_READ });
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const out = await hydrateDeal({ tenantId: ctx.tenantId, hubspotDealId: params.hubspotDealId });
  if (!out.ok && out.reason === "sor_not_connected") {
    return NextResponse.json({ ...out, cta: "connect_hubspot" }, { status: 409 });
  }
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out);
}
```

- [ ] **Step 3: Manual verify** (needs portal): `POST /api/mofu/deals/<realDealId>/hydrate` → live stage matches HubSpot; change stage in HubSpot, re-POST → new stage without full re-pull.
- [ ] **Step 4: Commit** `feat(mofu): hydrate route + MOFU rbac scopes (US-1.1)`

---

## Task 7: Deterministic signal scoring (US-2.1)

**Files:**
- Create: `src/lib/mofu/signalScoring.js`
- Test: `tests/mofu/signalScoring.test.js`

**Contract:** `score = recencyWeight(occurredAt, now) × typeWeight(kind) × intentWeight(hints)`, deterministic, independent of any LLM, in `[0, ~1.5]`.

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from "vitest";
import { scoreSignal, TYPE_WEIGHTS } from "@/lib/mofu/signalScoring";

const now = new Date("2026-06-06T00:00:00Z");
it("is deterministic for identical inputs", () => {
  const a = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
  const b = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
  expect(a).toBe(b);
});
it("recent transcript outscores an old note", () => {
  const recent = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
  const old = scoreSignal({ kind: "NOTE", occurredAt: "2026-04-01T00:00:00Z", now });
  expect(recent).toBeGreaterThan(old);
});
it("positive intent hints raise the score", () => {
  const base = scoreSignal({ kind: "EMAIL", occurredAt: "2026-06-05T00:00:00Z", now });
  const hot = scoreSignal({ kind: "EMAIL", occurredAt: "2026-06-05T00:00:00Z", now, intentHints: ["pricing", "contract"] });
  expect(hot).toBeGreaterThan(base);
});
it("knows the closed kind weights", () => {
  expect(Object.keys(TYPE_WEIGHTS).sort()).toEqual(["CALL_TRANSCRIPT","EMAIL","MEETING","NOTE","STAGE_CHANGE"]);
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/mofu/signalScoring.js`

```js
export const TYPE_WEIGHTS = { CALL_TRANSCRIPT: 1.0, MEETING: 0.9, STAGE_CHANGE: 0.8, EMAIL: 0.6, NOTE: 0.4 };
const HALF_LIFE_DAYS = 14;
const INTENT_TERMS = ["pricing", "contract", "demo", "timeline", "budget", "decision", "proposal", "renew"];

export function recencyWeight(occurredAt, now = new Date()) {
  if (!occurredAt) return 0.5;
  const days = Math.max(0, (now.getTime() - new Date(occurredAt).getTime()) / 86_400_000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS); // 1.0 now → 0.5 at 14d
}
export function intentWeight(hints = []) {
  const hits = hints.filter((h) => INTENT_TERMS.includes(String(h).toLowerCase())).length;
  return 1 + Math.min(0.5, hits * 0.15);
}
export function scoreSignal({ kind, occurredAt, now = new Date(), intentHints = [] }) {
  const type = TYPE_WEIGHTS[kind] ?? 0.3;
  return Number((recencyWeight(occurredAt, now) * type * intentWeight(intentHints)).toFixed(4));
}
```

- [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** `feat(mofu): deterministic signal scoring (US-2.1)`

---

## Task 8: Signal ingestion — dedupe, bound, persist (US-2.1)

**Files:**
- Create: `src/lib/mofu/ingestSignal.js`
- Test: `tests/mofu/ingestSignal.test.js`

**Contract:** dedupe by `(tenantId, source, kind, externalId)` (idempotent upsert); score via Task 7; `signalReferenceId` derived deterministically from the unique key (never fabricated); malformed/empty payload → `{ skipped:true, reason:'malformed' }` + warning, no throw; bound to most-recent N per kind (prune older).

- [ ] **Step 1: Write failing tests** (inject prisma):

```js
import { describe, it, expect, vi } from "vitest";
import { ingestSignal } from "@/lib/mofu/ingestSignal";

function fakePrisma() {
  return { dealSignal: { upsert: vi.fn(async (a) => ({ id: "sig_1", ...a.create })), count: vi.fn(async () => 0), findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })) } };
}
it("upserts a scored signal idempotently", async () => {
  const prisma = fakePrisma();
  const out = await ingestSignal({ tenantId: "t1", dealId: "deal_1", kind: "CALL_TRANSCRIPT", source: "hubspot", externalId: "call_99", summary: "Discovery call", occurredAt: "2026-06-05T00:00:00Z" }, { prisma, now: new Date("2026-06-06T00:00:00Z") });
  expect(out.ok).toBe(true);
  expect(prisma.dealSignal.upsert).toHaveBeenCalledTimes(1);
  expect(out.signal.score).toBeGreaterThan(0);
});
it("skips malformed payload without throwing", async () => {
  const prisma = fakePrisma();
  const out = await ingestSignal({ tenantId: "t1", dealId: "deal_1", kind: "EMAIL" /* no externalId */ }, { prisma });
  expect(out).toMatchObject({ ok: false, skipped: true, reason: "malformed" });
  expect(prisma.dealSignal.upsert).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/mofu/ingestSignal.js`

```js
import { prisma as defaultPrisma } from "@/lib/prisma";
import { scoreSignal } from "@/lib/mofu/signalScoring";

const MAX_PER_KIND = 25;

export async function ingestSignal(input, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const now = deps.now ?? new Date();
  const { tenantId, dealId, kind, source, externalId } = input;
  if (!tenantId || !dealId || !kind || !source || !externalId) {
    return { ok: false, skipped: true, reason: "malformed" };
  }
  const signalReferenceId = `${source}:${kind}:${externalId}`;
  const score = scoreSignal({ kind, occurredAt: input.occurredAt, now, intentHints: input.intentHints ?? [] });

  const signal = await prisma.dealSignal.upsert({
    where: { tenantId_source_kind_externalId: { tenantId, source, kind, externalId } },
    create: { tenantId, dealId, scope: input.scope ?? "DEAL", kind, source, externalId, summary: input.summary ?? null, score, signalReferenceId, occurredAt: input.occurredAt ? new Date(input.occurredAt) : null, raw: input.raw ?? undefined },
    update: { summary: input.summary ?? undefined, score, occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined, raw: input.raw ?? undefined },
  });

  // Bound volume: keep most-recent N per (deal, kind)
  const count = await prisma.dealSignal.count({ where: { tenantId, dealId, kind } });
  if (count > MAX_PER_KIND) {
    const stale = await prisma.dealSignal.findMany({ where: { tenantId, dealId, kind }, orderBy: { createdAt: "desc" }, skip: MAX_PER_KIND, select: { id: true } });
    if (stale.length) await prisma.dealSignal.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
  return { ok: true, signal };
}
```

- [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** `feat(mofu): deal signal ingestion + dedupe/bound (US-2.1)`

---

## Task 9: Checkpoint A (manual end-to-end)

**Files:**
- Create: `scripts/checkpoint-a.mjs`

- [ ] **Step 1:** Write a script that (with a connected sandbox portal + a known `hubspotDealId` passed as argv) calls `hydrateDeal`, prints live stage, then calls `ingestSignal` with a sample transcript and prints the scored signal. Run: `node --env-file=.env scripts/checkpoint-a.mjs <hubspotDealId>`.
- [ ] **Step 2: Acceptance (Checkpoint A):** sandbox deal hydrates (live stage from HubSpot, cached intel persisted) and a transcript becomes a scored `DealSignal`. Confirm: change the stage in HubSpot → re-run → live stage updates without a full re-pull; mock a 500 (temporarily point client at a bad path) → stale-context fallback, no crash.
- [ ] **Step 3:** Run `npm run lint` and `npm run test:run` — all green; TOFU untouched.
- [ ] **Step 4: Commit** `chore(mofu): checkpoint A verification script`

---

## Self-Review (run before handing off)

- **Spec coverage:** US-1.1 (Tasks 4–6), US-2.1 (Tasks 7–8), one additive migration (Task 0), `SorAdapter` single-impl seam (Task 4), not-connected no-op (Tasks 4–5), stale-context fallback (Task 5), tenant isolation + RBAC (Task 6), deterministic scoring unit-tested (Task 7). Epic 0 HubSpot foundation (Tasks 1–3) precedes Epic 1 — the gap the findings note flagged.
- **Grep gate:** no Pilot/Aura/HeyParrot import or runtime call introduced; only HubSpot + (later) LLM providers are external. No second SOR adapter.
- **Deferred to later phases (not in this plan):** capability discovery logic (Epic 5/Phase B — model added in Task 0), Heptapod bundle (Phase B), NBA jury (Phase B — Anthropic client + `@anthropic-ai/sdk`), execution rails/collateral (Phase C), surfaces/transition/orchestration + HubSpot webhook route (Phase D). Open decisions D3–D7 confirmed at their phase.
- **Stop-for-review:** at Checkpoint A before starting Phase B.
```
