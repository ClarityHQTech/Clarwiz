# Clarwiz MOFU (AE Assist) — Ultraplan (Executable)

> **Companion to** `MOFU Roadmap (1).md`, `MOFU UI Inventory.md`, `Mofu Ultraplan.md` (vision, widget catalog, flows).
> This is the **build sheet**: ordered tasks, real file targets in *this* repo, dependencies, acceptance.
> **Goal =** the complete funnel after TOFU hands off — **MQL → Deal → Closed-Won**.
>
> **Author:** Yash Vats · **Last updated:** 2026-06-07 · **Supersedes** the deployed `feat/mofu-phase-a` branch (fresh design — do not follow that branch).

---

## 0. Conventions (read once)

- **One app.** MOFU is a module *inside* Clarwiz (`Next.js 14 App Router`, Prisma 6, Postgres, Vercel, OpenAI). Routes: `src/app/assist/*` (pages), `src/app/api/assist/*` (server). No new repo, no fork.
- **TOFU and MOFU are composable peer layers on a shared kernel.** The shared kernel/infra = identity & access (`Tenant`, `User`, `TenantMembership`, RBAC `permissions.js`, auth/session), the **CRM graph** (`Company`, `BusinessUser`, `Contact`, signals), and platform (`prisma.js`, `encryptSecret.js`, integration framework, settings UX). A tenant runs **TOFU-only, MOFU-only, or both** (§0.1). MOFU **never** requires a TOFU-outreach row (`Campaign`/`ContactCampaign`/`CommunicationLog`/`CommunicationTemplate`).
- **Clarwiz MOFU is the intelligence layer — it holds all the context and computes over it.** Deal/company insights, NBAs, and signals are **computed inside Clarwiz** (context assembled from the shared CRM graph + HubSpot + optional TOFU history; run through OpenAI with the AURA-structured prompts, handed over later) and **persisted as first-class MOFU entities**. There is **no live external AURA backend** in this design — AURA is a *prompt & response-shape reference only* (`aura-frontend/AURA_SERVICES.md`).
- **Identity:** CRM objects keyed by HubSpot id (`hubspotDealId`/`hubspotCompanyId`/`hubspotContactId`), resolved into the shared graph (`Account`/`Company`/`Contact`). Clarwiz masters nothing in HubSpot — it mirrors + enriches.
- **Secrets server-side only.** Third-party tokens are AES-256-GCM encrypted at rest; the browser never sees them.
- **Task IDs:** `X#` cross-cutting/DB · `F#` foundation · `H#` HubSpot · `D#` dashboard · `W#` deal Workroom · `L#` Lead · `K#` collateral · `C#` chat · `A#` action-log/demo · `B#` optional TOFU bridge.

---

## 0.1 Layer composability — three deployment modes

```
  ┌──────────────────── SHARED KERNEL / INFRA (all layers) ─────────────────────┐
  │ Identity & access:  Tenant · User · TenantMembership · RBAC scopes · auth    │
  │ CRM graph ("good infra"):  Company · BusinessUser · Contact · *Signal        │
  │ Platform:  prisma.js · encryptSecret.js · openaiClient · integration · setup │
  └─────────────────────────────────────────────────────────────────────────────┘
         ▲                                                          ▲
  ┌──────┴───────────┐                                   ┌──────────┴────────────────┐
  │  TOFU domain      │             HubSpot SOR           │  MOFU domain (INTELLIGENCE)│
  │ Campaign·         │   ←──── shared meeting point ──→  │ Account·Deal·DealInsight·  │
  │ ContactCampaign·  │            (object ids)           │ CompanyInsight·            │
  │ CommunicationLog· │                                   │ NbaRecommendation·Signal·  │
  │ CommunicationTmpl │                                   │ CollateralIndex·           │
  └───────────────────┘                                   │ AssistActionLog·MofuIntegr.│
                                                          └────────────────────────────┘
        both layers read/write the SAME Company · BusinessUser · Contact graph
        MOFU holds all the context and computes insights/NBAs over it (in Clarwiz)
```

| Mode | Tenant enables | Gate | What runs | TOFU outreach rows? | CRM graph rows? |
|------|----------------|------|-----------|---------------------|------------------|
| **TOFU-only** | campaigns / channels | campaign scopes + channel integration | outreach → qualify → MQL to HubSpot | yes | yes (from outreach) |
| **MOFU-only** | AE Assist | MOFU scopes (X2) + `MofuIntegration` | dashboard · deal/lead workroom · insights · NBAs · collateral · chat over the tenant's **existing HubSpot deals** | **none** | **yes — hydrated from HubSpot sync** |
| **Both** | both | both gates | TOFU hands off to MOFU **and** Lead Workroom shows TOFU outreach history | yes | yes (shared, written by both) |

**Composability rules (enforced by the tasks below):**
1. **MOFU builds on the shared CRM graph, not a disposable cache.** HubSpot sync hydrates `Account`/`Company`/`BusinessUser`/`Contact`; MOFU intelligence reads/writes that graph. A MOFU-only tenant gets a real normalized CRM, populated from HubSpot, with **zero** TOFU outreach rows.
2. **No TOFU-outreach dependency.** MOFU models FK only to the shared kernel/CRM-graph — never to `Campaign`/`ContactCampaign`/`CommunicationLog`/`CommunicationTemplate`. The *only* cross-domain read is L1's `CommunicationLog` enrichment, degrading to "No Clarwiz outreach history" when absent.
3. **Independent gating.** Nav renders TOFU and MOFU sections separately per-layer gate. (Hackathon: implicit via scopes + integration presence. Productionization: explicit `Tenant.enabledLayers String[]`.)
4. **HubSpot is the seam between layers; the shared graph is the join inside Clarwiz.** Layers never call each other's modules.
5. **TOFU→MOFU handoff is an opt-in bridge** (Mode 3, task **B1**) in TOFU's `qualifyContact.js` behind a flag — not in the MOFU module.

---

## 1. Build order (dependency graph)

```
X1 db migrate ─┬─> X2 scopes ─┐
X1 encryption ─┘             │
                             ▼
            F1 creds (settings) ──> H1 HubSpot client ─> H2 CRM-graph sync (Account/Contact/Deal)
                 │                                              │
                 └──> F2 intelligence core (context + prompts) ─┤
                       (computes+stores DealInsight/Company-     │
                        Insight/Nba/Signal over the graph)       ▼
                                                          D1 dashboard ─> D2 company drawer (CompanyInsight)
            F2 ─> W1 deal workroom (DealInsight) ─> W2 NBA (NbaRecommendation→email) ─> W3 taskbook/notes
                                                          │
                                                          └─> K1 collateral dir ─> K2 suggest+viewer
            F2 ─> L1 lead workroom (+TOFU CommunicationLog enrichment) ─> L2 promote→deal
            F2 ─> C1 chat dock (in-Clarwiz over context)
(all writers W2/W3/L2/K2) ─> A1 action-log feed ─> A2 seed + demo run-through

   B1 TOFU→MOFU bridge (Mode-3 only, opt-in flag in TOFU qualifyContact.js) ··· independent, optional

Milestones:  M1 spine live · M2 UC2 (deal→close) · M3 UC1 (lead→deal) · M4 both flows E2E + demo
```

Every MOFU task (F/H/D/W/L/K/C/A) runs in **MOFU-only** mode. **B1** and the L1 timeline are the *only* parts touching TOFU — both Mode-3 optional, no-op cleanly when TOFU data is absent.

---

## 2. Database — TOFU architecture imprinted onto MOFU  ⟵ *the explicit ask*

MOFU adds models to `prisma/schema.prisma` in **one additive migration**, **building on the shared CRM graph** (`Company`/`BusinessUser`/`Contact`) rather than a throwaway JSON cache. HubSpot stays the SOR; Clarwiz mirrors + **stores computed intelligence**.

> ⚠️ **Two corrections baked in here.**
> 1. **Conventions:** the old draft used **snake_case + plaintext tokens**, which do *not* match the live TOFU schema. Below imprints the **actual** TOFU conventions (camelCase, no `@map`, `cuid()`, `Tenant`-cascade, Prisma enums, `encrypted*` tokens).
> 2. **Shape:** MOFU is the **intelligence layer**, so insights/NBAs/signals are **stored entities** built on the shared graph — not a `AssistEntityCache` JSON blob and not proxied AURA responses.

### 2.1 TOFU conventions checklist (every MOFU model MUST satisfy)

| # | TOFU convention | Evidence in `schema.prisma` | MOFU rule |
|---|-----------------|-----------------------------|-----------|
| 1 | `String @id @default(cuid())` | every model | all MOFU models |
| 2 | **camelCase columns, no `@map`** | `tenantId`, `businessUserId`, `createdAt` | camelCase everywhere — **never** snake_case |
| 3 | `createdAt`/`updatedAt` timestamps | `@default(now())` / `@updatedAt` | all models (append-only logs/insights = `createdAt`/`computedAt`) |
| 4 | Tenant scoping + cascade | `tenant Tenant @relation(…, onDelete: Cascade)` | every tenant-scoped model + **back-relation on `Tenant`** |
| 5 | Encrypted tokens, never plaintext | `encryptedAccessToken`, `encryptedMetaToken` | `encryptedHubspotToken` (no AURA token — intelligence is in-house) |
| 6 | One-per-tenant integration shape | `LinkedInIntegration` (`tenantId @unique`, `status @default("pending")`, `connectedAt`) | `MofuIntegration` mirrors it |
| 7 | Prisma enums (SCREAMING_SNAKE) | `ContactPersona`, `ContactCampaignStatus` | stage band / status / NBA status / signal type / collateral type+source+stage / action |
| 8 | Explicit `@@index` / `@@unique` | `@@index([tenantId])`, `@@unique([contactId, campaignId])` | tenant + lookup indexes on each; composite uniques for HubSpot ids |
| 9 | `Json` for flexible payloads | `providerMeta Json?`, `payload` | insight payloads, NBA draft, raw HS props |
| 10 | Reuse the shared CRM graph | `Contact` = tenant↔`BusinessUser`+persona; `Company` global | `Account` = tenant↔`Company` (company-side mirror of `Contact`); MOFU FKs into the graph |

### 2.2 Shared-infra additions (additive columns — tenant-scoped HubSpot linkage)

`Company`/`BusinessUser` are **global** (cross-tenant); HubSpot ids are **per-tenant-portal**, so linkage lives on the tenant-scoped bridges:

```prisma
// model Contact { … existing … }
  hubspotContactId String?
  // + @@unique([tenantId, hubspotContactId])
```
(`Account` below is the new company-side tenant bridge carrying `hubspotCompanyId`.)

### 2.3 MOFU domain — Prisma additions

```prisma
enum DealStageBand  { LEAD  DEAL_EARLY  DEAL_LATE }
enum DealStatus     { OPEN  WON  LOST }
enum NbaStatus      { SUGGESTED  DRAFTED  APPROVED  EXECUTED  DISMISSED }
enum SignalType     { OBJECTION  CONFUSION  EXPANSION  CHURN_RISK  DEAL_HEALTH  WHITESPACE  COMPETITIVE  INTEGRATION  REVOPS }
enum CollateralType { MARKETING_DOC  PITCH_DECK  BATTLECARD  ONE_PAGER  CASE_STUDY  EMAIL_TEMPLATE  OTHER }
enum CollateralSrc  { GENERATED  HEYPARROT  PILOT  UPLOAD }
enum FunnelStage    { LEAD  DEAL_EARLY  DEAL_LATE  ANY }
enum AssistAction   { INSIGHT_COMPUTED  NBA_DRAFTED  NBA_EXECUTED  EMAIL_DRAFTED  COLLATERAL_SENT  TASK_CREATED  NOTE_ADDED  DEAL_CREATED  MEETING_SCHEDULED  CHAT_QUERY }

/// Per-tenant MOFU config: HubSpot creds + LLM/prompt config (one row per tenant — mirrors LinkedInIntegration).
model MofuIntegration {
  id                    String    @id @default(cuid())
  tenantId              String    @unique
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  encryptedHubspotToken String                        // private-app token, AES-256-GCM
  hubspotPortalId       String?                       // deep links into HubSpot UI
  defaultOwnerId        String?                       // HubSpot owner for "my leads/deals" filters
  insightModel          String?                       // e.g. gpt-4o; falls back to env default
  promptVersion         String?                       // which AURA-derived prompt pack is live
  status                String    @default("pending") // pending | connected | error
  connectedAt           DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

/// Tenant ↔ Company bridge (company-side mirror of Contact) + HubSpot linkage. The dashboard "company" unit.
model Account {
  id              String          @id @default(cuid())
  tenantId        String
  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  companyId       String?                              // FK into the shared global Company graph
  company         Company?        @relation(fields: [companyId], references: [id], onDelete: SetNull)
  hubspotCompanyId String
  ownerId         String?
  lifecycleStage  String?
  payload         Json?                                // raw HS company props subset
  syncedAt        DateTime        @default(now())
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  deals           Deal[]
  companyInsights CompanyInsight[]
  signals         Signal[]

  @@unique([tenantId, hubspotCompanyId])
  @@index([tenantId])
  @@index([tenantId, ownerId])
  @@index([companyId])
}

/// Tenant-scoped deal mirror + the anchor everything intelligent hangs off.
model Deal {
  id            String              @id @default(cuid())
  tenantId      String
  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  accountId     String?
  account       Account?            @relation(fields: [accountId], references: [id], onDelete: SetNull)
  hubspotDealId String
  name          String
  stageLabel    String?                                 // raw HubSpot stage
  stageBand     DealStageBand?                          // normalized for collateral/insight rules
  amount        Float?
  status        DealStatus          @default(OPEN)
  ownerId       String?
  score         Int?                                    // latest DealInsight score, denormalized for lists
  lastActivityAt DateTime?
  payload       Json?
  syncedAt      DateTime            @default(now())
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  insights      DealInsight[]
  nbas          NbaRecommendation[]
  signals       Signal[]
  dealContacts  DealContact[]

  @@unique([tenantId, hubspotDealId])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([accountId])
  @@index([tenantId, ownerId])
}

/// Deal ↔ Contact stakeholders (reuses the shared Contact graph).
model DealContact {
  id        String   @id @default(cuid())
  dealId    String
  deal      Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  contactId String
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  role      String?
  createdAt DateTime @default(now())

  @@unique([dealId, contactId])
  @@index([contactId])
}

/// Stored computed deal intelligence (AURA-structured payload, computed in Clarwiz).
model DealInsight {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  dealId        String
  deal          Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  score         Int?
  briefing      String?  @db.Text
  summary       String?  @db.Text
  payload       Json                                   // risks[], coachingTip, gtmPaths[], earlyWarnings[]
  model         String?
  promptVersion String?
  tokensUsed    Json?                                  // {model, prompt, completion} — mirror CommunicationLog.providerUsage
  computedAt    DateTime @default(now())

  @@index([dealId])
  @@index([tenantId, computedAt])
}

/// Stored computed company intelligence (the 10-tab payload from MOFU UI Inventory §B).
model CompanyInsight {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  accountId     String
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  payload       Json                                   // overview, stakeholders, value, risks, actions, timeline, competitive, expansion, research, signals
  model         String?
  promptVersion String?
  tokensUsed    Json?
  computedAt    DateTime @default(now())

  @@index([accountId])
  @@index([tenantId, computedAt])
}

/// Next best actions — computed in Clarwiz, with full draft→approve→execute lifecycle.
model NbaRecommendation {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  dealId      String?
  deal        Deal?        @relation(fields: [dealId], references: [id], onDelete: Cascade)
  contactId   String?
  contact     Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
  signalId    String?
  signal      Signal?      @relation(fields: [signalId], references: [id], onDelete: SetNull)
  actionType  String                                   // draft_email | schedule_meeting | create_task | send_collateral | clarify_technical
  title       String
  score       Int          @default(0)
  rationale   String?      @db.Text
  status      NbaStatus    @default(SUGGESTED)
  draftPayload Json?                                   // generated email html, collateral ref, task subjects
  executedAt  DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([tenantId])
  @@index([dealId])
  @@index([tenantId, status])
}

/// MOFU buying/risk signals over the context (distinct from TOFU's BusinessUserSignal).
model Signal {
  id             String              @id @default(cuid())
  tenantId       String
  tenant         Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  dealId         String?
  deal           Deal?               @relation(fields: [dealId], references: [id], onDelete: Cascade)
  accountId      String?
  account        Account?            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  type           SignalType
  tier           Int?                                  // T1/T2/T3 (UI Inventory W-C10)
  headline       String
  evidence       String?             @db.Text
  sourceUrl      String?
  suggestedAngle String?             @db.Text
  slaHours       Int?
  detectedAt     DateTime            @default(now())
  createdAt      DateTime            @default(now())
  nbas           NbaRecommendation[]

  @@index([tenantId])
  @@index([dealId])
  @@index([tenantId, type])
}

/// Unified marketing + sales collateral directory.
model CollateralIndex {
  id          String         @id @default(cuid())
  tenantId    String
  tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  type        CollateralType
  source      CollateralSrc
  externalId  String?
  slug        String?                                  // HeyParrot viewer slug
  url         String?
  funnelStage FunnelStage    @default(ANY)
  tags        String[]       @default([])
  companyHsId String?
  dealHsId    String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([tenantId, funnelStage])
  @@index([tenantId, companyHsId])
}

/// Append-only audit + activity feed — the demo narrative.
model AssistActionLog {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  actorUserId String?                                  // null = system/intelligence-computed
  entityType  String                                   // deal | account | contact
  hsObjectId  String?
  action      AssistAction
  payload     Json?                                    // ids/subjects only — no PII/message bodies
  createdAt   DateTime     @default(now())

  @@index([tenantId, createdAt])
  @@index([tenantId, hsObjectId])
}
```

**Back-relations to add inside existing models:**

```prisma
// model Tenant { … }
  mofuIntegration  MofuIntegration?
  accounts         Account[]
  deals            Deal[]
  dealInsights     DealInsight[]
  companyInsights  CompanyInsight[]
  nbas             NbaRecommendation[]
  signals          Signal[]
  collateralIndex  CollateralIndex[]
  assistActionLogs AssistActionLog[]

// model Company { … }   (global — MOFU joins via Account)
  accounts         Account[]

// model Contact { … }
  hubspotContactId String?
  dealContacts     DealContact[]
  nbas             NbaRecommendation[]
  // + @@unique([tenantId, hubspotContactId])
```

> **Minimum slice for the 15h demo:** `MofuIntegration`, `Account`, `Deal`, `DealInsight`, `NbaRecommendation`, `CollateralIndex`, `AssistActionLog` + `Contact.hubspotContactId`. `CompanyInsight`, `Signal`, `DealContact` are the same migration (good infra now), populated as Company-view and signal features land.

---

## 3. Cross-cutting foundations (X — do first, no UI)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **X1** | **Apply MOFU schema** (§2) in **one additive migration** | `prisma/schema.prisma` (+models/enums, shared-infra columns, back-rels), `prisma/migrations/<ts>_mofu_assist/` | — | `npm run db:migrate` clean against local DB ([[clarwiz-postgres-setup]]: `ywaths`@Homebrew PG18); `npx prisma validate` passes; **zero changes to TOFU tables** (only additive `Contact.hubspotContactId` + new tables). |
| **X2** | **MOFU RBAC scopes** | `src/lib/permissions.js` (extend `PERMISSIONS`) | — | New keys: `ASSIST_VIEW:"assist:view"`, `DEAL_READ:"deal:read"`, `INSIGHT_RUN:"insight:run"`, `NBA_EXECUTE:"nba:execute"`, `COLLATERAL_MANAGE:"collateral:manage"`, `HUBSPOT_WRITE:"hubspot:write"`. `ADMIN`/superadmin bypass via `hasPermission`. |
| **X3** | **Token encryption helper** (imprint convention #5) | `src/lib/encryptSecret.js` (+`SCRYPT_SALT_MOFU`, `encryptMofuToken`/`decryptMofuToken` via existing `encryptWithSalt`/`decryptWithSalt`) | — | Round-trip test: `decryptMofuToken(encryptMofuToken(x)) === x`; ciphertext base64, not plaintext. |

---

## 4. Foundation — credentials & the intelligence core (Epic 1)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **F1** | **MOFU settings page** — paste + verify HubSpot creds + pick insight model; upsert `MofuIntegration` (token via `encryptMofuToken`) | settings page under `src/app/settings/*`; `src/app/api/assist/settings/route.js`; `src/lib/assist/mofuIntegration.js` | X1,X3 | Valid token saves (single row, re-save updates); `{verified:{hubspot}}` from 1 live HubSpot test call (`GET /crm/v3/objects/contacts?limit=1`); bad token → row saved, `verified.hubspot:false`, warning, no crash; token masked (`••••`+last4), never in responses/logs. |
| **F2** | **Intelligence core** — (a) **context assembler**: gather deal/company context from the CRM graph + `Deal`/`Account`/`Signal` (+ optional TOFU `CommunicationLog`); (b) **prompt runner**: execute AURA-structured prompts over OpenAI and **persist** `DealInsight`/`CompanyInsight`/`NbaRecommendation`/`Signal` | `src/lib/assist/context/*` (assemblers), `src/lib/assist/intelligence/{deal,company,nba}.js`, `src/lib/assist/prompts/*` (slots; filled when AURA prompts land), reuse `src/lib/openaiClient.js` + `src/lib/execution/modelRouter.js` | X1,F1 | Given a `dealId`, assembler returns a typed context object; runner produces a **stored** `DealInsight` (score+briefing+payload) via the prompt harness; **token usage recorded** in `tokensUsed` (mirrors `CommunicationLog.providerUsage`); idempotent recompute updates latest; until real prompts arrive, a versioned **stub prompt** returns a schema-valid skeleton so storage + UI are exercisable. `INSIGHT_COMPUTED` logged. |

> **AURA is a reference, not a runtime.** Response shapes come from `aura-frontend/AURA_SERVICES.md` (deal-service-bundle, company-service-bundle, nba shapes). Prompts are slotted in `src/lib/assist/prompts/*` and versioned via `MofuIntegration.promptVersion`. **No `auraToken`, no proxy route, no live AURA calls.**

---

## 5. HubSpot read model — hydrate the CRM graph (Epic 1 cont.)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **H1** | **HubSpot client** (private-app token: search my open leads/deals, companies, contacts, associations) | `src/lib/assist/hubspot.js` (CRM v3 Search, ≤4 req/s, page 100, max 3 pages/type; Associations v4) | F1 | Given token: MQL contacts (`lifecyclestage=marketingqualifiedlead`, optional owner), open deals (`hs_is_closed=false`), associated companies/contacts; 401 surfaced distinctly. |
| **H2** | **CRM-graph sync** → upsert `Company`+`Account`, `BusinessUser`+`Contact` (`hubspotContactId`), `Deal`(+`DealContact`) | `src/app/api/assist/sync/route.js`; `src/lib/assist/syncGraph.js` | H1,X1 | Hydrates the **shared graph** (not a JSON cache): HS company→`Company`(by domain/name)+`Account`(`hubspotCompanyId`); HS contact→`BusinessUser`(by email)+`Contact`(`hubspotContactId`,persona); HS deal→`Deal`(`stageBand`, `status`) + `DealContact`. Re-run upserts, advances `syncedAt`, no dupes; 401→abort+`hubspot_auth` banner, graph intact; 429→`Retry-After` once then `partial:true`; ≤300 objs <20s. **MOFU-only safe:** writes only shared+MOFU tables, no TOFU rows. |

---

## 6. AE Dashboard (Epic 2) — **M1**

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **D1** | **`/assist` dashboard** — Open Leads · Working Deals · Companies rail (server component over `Deal`/`Account`/`Contact`) + sync button + staleness chip | `src/app/assist/page.js`, `src/app/assist/layout.js`, `src/components/assist/*` | H2 | 3 sections render from the graph (<1s); HubSpot deep links via `hubspotPortalId`; lead = MQL `Contact` with no open `Deal`; deals sorted by `lastActivityAt`; empty graph → "Run first sync"; no `MofuIntegration` → redirect to settings. |
| **D2** | **Company drawer** — `CompanyInsight` (compute-on-open via F2 if stale) + signals + contacts + matched collateral + company NBAs | `src/components/assist/CompanyDrawer.jsx`; calls F2 | F2,D1 | 5 sections render; insight stale/missing → compute via F2 then store+show, with "Analyzing…" state (signals/contacts visible meanwhile); compute failure → cached/graph-only sections + retry, error logged once. |

> **M1 — Spine live:** F1+F2+H2+D1 → "day of an AE" screen on the real HubSpot-hydrated graph.

---

## 7. Deal Workroom — UC2 (Epic 3) — **M2**

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **W1** | **`/assist/deal/[id]` insight render** — load latest `DealInsight` (compute via F2 if stale); render briefing, score, summary, risks, coaching, GTM paths, signals, amount/last-activity | `src/app/assist/deal/[id]/page.js`, `src/components/assist/deal/*`, `src/lib/assist/dealViewModel.js` | F2,H2 | All sections from stored `DealInsight`+`Deal`+`Signal`; stale/missing → compute+store then render with "Analyzing…"; score trend from historical `DealInsight` rows (`computedAt`); compute failure → header (amount/activity) + error card + retry, other panels hidden not broken; header paints <1.5s. (UI spec: `aura-frontend/DealInsights2.jsx`.) |
| **W2** | **NBA → editable email + collateral** — surface `NbaRecommendation`s (computed by F2); execute → generate draft email (OpenAI) + auto-select collateral; lifecycle `SUGGESTED→DRAFTED→EXECUTED` | `src/components/assist/deal/NbaDrawer.jsx`; `src/app/api/assist/nba/[id]/execute/route.js`; `src/lib/assist/intelligence/nba.js` | W1 | NBA list ranked by `score`; execute → populated editable modal (draft stored in `draftPayload`), edits persist, copy works; collateral-type NBA → `CollateralIndex` row + HeyParrot viewer (K2); dup in-flight clicks ignored; failure → toast + status reverts to `SUGGESTED` + log. Writes `AssistActionLog` `NBA_DRAFTED`/`NBA_EXECUTED`+`EMAIL_DRAFTED`. |
| **W3** | **Taskbook + notes write-back** — multi-select GTM steps → HubSpot tasks; inline note → HubSpot | `src/components/assist/deal/Taskbook.jsx`, `NoteBox.jsx`; `src/lib/assist/hubspot.js` (create tasks/notes) | W1 | 3 steps → 3 HubSpot tasks (single bulk request), `TASK_CREATED` log w/ subjects; note on deal timeline, `NOTE_ADDED` log; 0 selected → confirm disabled; upstream fail → toast + selection preserved. **Requires HubSpot write scopes.** |

> **M2 — UC2 (deal→close):** W1+W2+W3 → full deal assist loop, intelligence computed in Clarwiz, writes back to HubSpot.

---

## 8. Lead Workroom & promotion — UC1 (Epic 4) — **M3**

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **L1** | **`/assist/lead/[id]`** — company `CompanyInsight` + contact persona + signals + company NBAs + **TOFU CommunicationLog timeline** *(Mode-3 enrichment; absent for MOFU-only)* | `src/app/assist/lead/[id]/page.js`; `src/lib/assist/tofuTimeline.js` | F2,H2 | Core workroom renders with **zero TOFU data**. Timeline = best-effort read of `CommunicationLog` via `Contact`→`BusinessUser` on `BusinessUser.email` (lowercased); **MOFU-only / no match → "No Clarwiz outreach history"** (not error); no company → fallback panel, NBAs hidden; timeline query <300ms/500 rows. |
| **L2** | **Promote lead → deal** — create HubSpot deal, associate contact+company (Assoc v4), note "Created from Clarwiz MOFU", write `Deal`+`DealContact` to graph | `src/app/api/assist/promote/route.js`; modal in L1; `src/lib/assist/hubspot.js` | L1,W1 | Deal+2 associations+note in HubSpot; `Deal`/`DealContact` written; redirect to `/assist/deal/[id]` (insights compute); dashboard moves lead→deal without full re-sync; associate fail → deal kept + `warning` banner; create 4xx → modal error, nothing written; idempotent (button hidden if open deal exists); <5s. `AssistActionLog` `DEAL_CREATED`. **Requires HubSpot write scopes.** |

> **M3 — UC1 (lead→deal):** L1+L2 → promotion (TOFU history in Mode 3; clean empty state MOFU-only).

### 8.1 Optional TOFU↔MOFU bridge (Mode 3 only)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **B1** | **MQL handoff** — on TOFU `ContactCampaignStatus = QUALIFIED`, optionally upsert contact/company to HubSpot as MQL so MOFU picks it up | extend `src/lib/execution/qualifyContact.js` (guard `process.env.CLARWIZ_TOFU_TO_MOFU_BRIDGE === "1"`); reuse `src/lib/assist/hubspot.js` | H1 + TOFU qualify | Flag off (default) → TOFU unchanged, zero MOFU coupling. Flag on + `MofuIntegration` → qualified contact appears as HubSpot MQL; next H2 sync surfaces it in Open Leads. No `MofuIntegration` → no-op + one `[MOFU] info` log (never breaks qualification). |

---

## 9. Collateral Hub (Epic 5)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **K1** | **Unified directory** — CRUD over `CollateralIndex` (register link/slug+metadata; no file storage) + NBA auto-register hook | `src/app/assist/collaterals/page.js`; `src/app/api/assist/collateral/route.js` | X1 (writers from W2) | Filter by type/stage/tag/company; W2 collateral NBA auto-inserts (`source:GENERATED`,slug,context); neither url nor slug → validation error; same `(tenantId,slug)` → upsert; 200 items filter <100ms. |
| **K2** | **Intelligent suggestion + HeyParrot viewer** — deterministic scoring + server-composed viewer redirect | `src/lib/assist/collateralRank.js`; `src/app/api/assist/collateral/[id]/open/route.js` (302) | K1,W1,L1 | Score `+3` company match, `+2` stage (`Deal.stageBand`), `+1` per tag∩industry/persona, tie→newest; top-3 w/ reasons; "Use in draft" appends link to W2 modal (`COLLATERAL_SENT` log); Open → HeyParrot viewer (token composed server-side); url-only opens directly; no match → fall back `ANY` then empty panel; <200ms. |

---

## 10. AE Chat (Epic 6)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **C1** | **ChatDock** on all `/assist` pages — answers grounded in the AE's Clarwiz context (deals/accounts/insights/signals + page context), streamed from OpenAI | `src/components/assist/ChatDock.jsx`; `src/app/api/assist/chat/route.js`; reuse F2 context assemblers + `openaiClient.js` | F2 | Question on a deal page carries that deal's context, answer references it; thread persists across nav (store thread+messages in a light `AssistChatThread`/`...Message` pair or reuse session store — TBD with prompt pack); query 5xx → message failed + retry, input kept; pending bubble <500ms even if answer 20s; `CHAT_QUERY` logged (thread+entity only, **no message text**). |

> Chat is **in-Clarwiz** over the MOFU context graph — no external CRM-chat backend. (If a `AssistChatThread`/`AssistChatMessage` model is wanted, it's an additive migration in the same TOFU-convention style; flagged, not yet specced pending the chat prompt pack.)

---

## 11. Action log, seed & demo (Epic 7) — **M4**

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| **A1** | **`logAssistAction()` helper + dashboard activity feed** | `src/lib/assist/logAction.js`; feed in `src/app/assist/page.js` | W2,W3,L2,K2 | One of each action type → ordered, linked feed (newest 20, grouped by day); log failure never blocks user action (fire-and-forget, `warning`); feed query <100ms (`@@index([tenantId, createdAt])`). |
| **A2** | **Demo seed + run-through** — idempotent HubSpot seed (2 companies, 3 MQL leads w/ TOFU history, 2 deals, 6 collaterals) + Postgres graph + pre-computed insights | `scripts/seed-mofu-demo.js`; `docs/mofu/demo-script.md` | all | Fresh run → UC1+UC2 E2E, no manual fixes; re-run no dupes (check-by-name); insights pre-computed via F2; seed <2min. Includes a **MOFU-only** seed variant (no TOFU rows) proving standalone mode. |

> **M4 — Both flows E2E:** UC1 (dashboard→lead→NBA→promote→deal) + UC2 (deal→insight→NBA+collateral→tasks/note→feed), seed green on Vercel preview, **in MOFU-only and Both modes**.

---

## 12. 15-hour mapping (build blocks ↔ tasks)

| Hours | Block | Tasks | Milestone |
|-------|-------|-------|-----------|
| 0–1.5 | Foundations | X1 X2 X3 F1 H1 | — |
| 1.5–3.5 | Intelligence core + sync | F2 H2 | — |
| 3.5–5.5 | Dashboard | D1 D2 | **M1** |
| 5.5–9 | Deal Workroom | W1 W2 W3 | **M2** |
| 9–11 | Lead + promotion | L1 L2 | **M3** |
| 11–12.5 | Collateral Hub | K1 K2 | — |
| 12.5–13.5 | AE Chat | C1 | — |
| 13.5–14.5 | Glue + seed | A1 A2 | **M4** |
| 14.5–15 | Demo hardening | (fix top-3 uglies, fallback video) | — |

> **Critical-path input:** F2 is on the critical path and needs the **AURA prompt pack**. Until it lands, F2 ships with versioned **stub prompts** (schema-valid skeletons) so every downstream task is buildable and the swap to real prompts is a `promptVersion` change, not a refactor.

---

## 13. Inputs still needed / first-hour spikes

- **AURA prompt pack (critical, F2):** the deal-insight / company-insight / NBA prompts (you'll provide). Structure is known from `aura-frontend/AURA_SERVICES.md`; slots live in `src/lib/assist/prompts/*`. Stub prompts unblock the build meanwhile.
- **HubSpot private-app scopes (G-4):** `crm.objects.{contacts,companies,deals}.{read,write}`, `crm.schemas.*.read`, engagements (tasks/notes) — confirm hour-0. Per [[clarwiz-mofu-build]], a read-only PAT degrades W3/L2 writes; UC2 write-back + promotion need write scopes.
- **OpenAI:** `OPENAI_API_KEY` already in repo (TOFU uses it via `openaiClient.js`); pick `insightModel` (default e.g. `gpt-4o`).
- **Local DB reality:** migrate against `ywaths`@Homebrew PG18 (`postgresql://ywaths@localhost:5432/clarwiz`), **not** the system-PG path `docs/db.md` describes — see [[clarwiz-postgres-setup]].

---

## 14. Definition of Done

- **Story:** all acceptance (positive/negative/non-functional) pass · structured `[MOFU]` logs on error paths · contracts match §2 schema · dependency outages (timeout/401/5xx/LLM) don't break sibling features · **no third-party token reaches the client**.
- **PRD:** UC1 E2E + UC2 E2E green · Vercel preview deployed · seed (A2) clean · G-4 resolved or reclassified.
- **DB imprint (this doc):** `npx prisma validate` + `npm run db:migrate` clean · every MOFU model satisfies §2.1 checklist · zero TOFU tables altered (only additive `Contact.hubspotContactId` + new tables) · tokens stored only as `encrypted*`.
- **Composability (this doc):** every MOFU model FKs only to the shared kernel/CRM-graph (no TOFU-outreach FK) · a tenant with **zero TOFU rows** runs UC1+UC2 E2E (L1 shows empty-history state) · B1 flag off → TOFU unchanged · nav shows MOFU independently of TOFU.
- **Intelligence layer (this doc):** insights/NBAs/signals are **stored** (`DealInsight`/`CompanyInsight`/`NbaRecommendation`/`Signal`), computed in-Clarwiz over assembled context · token usage recorded · swapping the AURA prompt pack is a `promptVersion` change, no schema/route refactor.
```

