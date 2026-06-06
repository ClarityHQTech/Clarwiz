# Clarwiz — Three-Layer GTM Engine (TOFU · Transition · MOFU) — MOFU Build PRD

**Status:** Draft
**Author:** Yash (Clarwiz)
**Last Updated:** 2026-06-06
**Scope:** Builds the **MOFU** layer ("NBA for Account Executives") and the **Transition** layer onto the existing Clarwiz **TOFU** campaign engine. The product is three layers that each run **standalone or together**; they meet at the **HubSpot Deal**, never via direct module coupling. v1 is **HubSpot-only** (HubSpot is the system of record and execution substrate) behind a thin adapter seam so a second SOR can be added later. TOFU behaviour is unchanged except the additive transition trigger.

---

## 1. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-06 | Yash | Initial draft (multi-provider capability facade). |
| 0.2 | 2026-06-06 | Yash | **Rescoped to HubSpot-as-SOR.** Dropped the multi-CRM facade. Adopted the canonical MOFU design: Heptapod insight bundle, Deal + Company Insights, closed NBA action set, `NbaTemplate` catalog, universal draft→edit→approve→send rails, Path A/B collateral (Pilot patterns rebuilt natively), dual-model jury, HubSpot capability gating, operator dashboard. Added three-layer composability. Preserved open decisions D1–D7. |

---

## 2. Assumptions & Inferences

> **Assumed:** Pilot, Aura, and HeyParrot are **reference codebases, not dependencies**. Clarwiz reads their patterns and rebuilds them natively (Next.js / JS / Prisma). It never imports their packages, calls them at runtime, or APIs into them. **Basis:** §0 of the canonical design. **Override if:** a licensed package is explicitly approved for reuse.

> **Assumed:** The only external **runtime** integrations are **HubSpot** (SOR + execution substrate) and **LLM providers** (Anthropic + OpenAI for the dual-model jury). Everything else is owned in-repo. **Basis:** canonical §0/§1. **Override if:** a second SOR is greenlit for v1.

> **Assumed:** HubSpot holds engagements, emails, calls, meetings, notes, and transcripts. Note-taker and phone are **HubSpot-attached** integrations, not direct Clarwiz integrations. Clarwiz stores **derived intelligence only** — never a CRM mirror. Volatile CRM fields (stage, owner, amount, engagement timeline) are read live; slow intel (transcript summaries, signals, enrichment, NBA, collateral) is cached. **Basis:** canonical §1/§7 (D1 hybrid, decided). **Override if:** D1 is reopened.

> **Assumed:** The three layers are composable because they meet at the HubSpot Deal. **MOFU can hydrate directly from a HubSpot MQL** and does not require TOFU. **Transition** can fire from a TOFU qualification or a manual/HubSpot promotion. **TOFU** runs without either. **Basis:** canonical UC1 (HubSpot MQL → DealContext hydrate) + the user's composability requirement. **Override if:** a layer must hard-depend on another.

> **Assumed:** The "Heptapod" six-dimension analysis is the core IP. Signals and NBA are **derived views** over that bundle, not standalone steps. **Basis:** canonical §3/§13. **Override if:** the dimensional model changes.

> **Assumed:** "Brand Foundry / ICP / value proposition" map to the existing `TenantIcpContext`. MOFU reads it for buyer framing and collateral; it does not author it. **Basis:** prior turn + existing schema. **Override if:** Brand Foundry is a separate system.

---

## 3. Problem Statement

When a TOFU prospect qualifies, Clarwiz halts and the Account Executive takes over **by hand** — logging the deal in HubSpot, reading the call transcript, deciding the follow-up, drafting the email, building the one-pager, creating the next task — switching between HubSpot, a note tool, an email client, and Slack. The context TOFU already gathered is dropped at the handoff, and every AE re-derives "what do I do next on this deal" from scratch.

MOFU makes Clarwiz the **intelligence layer the AE works inside**: it reads context from HubSpot, computes the deal's intelligence bundle, signals, and ranked next-best-actions, and writes the approved action back to HubSpot — the AE never switches apps. The Transition layer removes the manual data entry at the handoff by provisioning the deal in HubSpot automatically and notifying the team.

---

## 4. Product Structure — three composable layers

| Layer | What it does | Runs standalone? | Seam |
|-------|--------------|------------------|------|
| **TOFU** (exists) | Dynamic next-best campaign comms (no hard-wired drip). In: Account Book, GTM Core (ICP, Signals), Campaign (from m360). Out: tracked email / LinkedIn / WhatsApp via a send-time delivery queue. | Yes — campaigns without MOFU. | Emits a **qualified prospect**. |
| **Transition** (build) | Prospect → opportunity. Creates **Company + Contact + Deal** in HubSpot and the Clarwiz `Deal` pointer; **notifies the team**. | Yes — can promote any qualified prospect or a manual/HubSpot-originated one, with or without MOFU. | Produces the **HubSpot Deal** (+ `Deal` pointer). |
| **MOFU** (build) | NBA for AEs over a HubSpot deal: insight bundle, signals, ranked NBA cards, collateral, execution via HubSpot, operator dashboard. | Yes — hydrates directly from a **HubSpot MQL**; does not require TOFU. | Consumes the **HubSpot Deal**. |

The layers do **not** call each other directly. TOFU and MOFU meet at HubSpot (and the `Deal` pointer). This is what makes each independently shippable and sellable. Build every cross-layer touchpoint as a HubSpot read/write or a `Deal`-pointer reference — never an import from another layer's internals.

---

## 5. System Context

**The core loop (one per deal; every use case is a position in it):**
```
CONTEXT ──▶ NBA (decide) ──▶ ACTION (execute) ──▶ ENGAGEMENT (capture) ──▶ CONTEXT
   ▲                                                                          │
   └────────────────────────────── recompute ────────────────────────────────┘
```
- **Decide:** signals → ranked NBA candidates (dual-model jury).
- **Execute:** draft → edit → approve → send via HubSpot.
- **Capture:** HubSpot logs the engagement.
- **Recompute:** a new signal (transcript landed, reply, stage change) re-triggers the NBA brain. On-demand "suggest now" also exists.

**Runtime integrations:** HubSpot (read context, write actions, discover capabilities); Anthropic + OpenAI (jury). **No other external runtime calls.** Pilot/Aura/HeyParrot contribute patterns only — rebuilt natively.

**Auth & access:** HubSpot via the tenant's stored OAuth token, encrypted with the existing `encryptSecret.js`. MOFU routes reuse `authContext.js` + `permissions.js` (RBAC). Inbound HubSpot webhooks use the existing per-tenant webhook-token pattern (`IntegrationWebhook`).

**Existing contracts to conform to:** Prisma 6 (one additive migration), JavaScript/JSX + `@/` alias, Chakra UI, the `CommunicationLog` send/track ledger (reused for Document sends), the TOFU "not-connected → no-op, don't throw" behaviour, and `modelRouter.js` (extended to a cross-provider jury).

---

## 6. Design Goals

- **HubSpot is the system of record; Clarwiz stores derived intelligence only.** Never build a CRM mirror. Read volatile fields live; cache slow intel. If you're tempted to persist a HubSpot field that changes often, read it live instead.
- **One adapter seam, HubSpot-only in v1.** The NBA brain reads context through a single `SorAdapter` interface with exactly one implementation (HubSpot). A second SOR can be added later without touching the brain. Do **not** build speculative second adapters.
- **Closed action-type set.** The LLM **ranks and parameterizes** actions from a fixed catalog; it never invents action types. Each type maps to one real executor and is guardrailed.
- **Universal execution rails with a mandatory approve gate.** Every action rides `card → draft → editor → approve → send via HubSpot → tracked`. Only the draft generator differs by type. The AE owns the send.
- **Dual-model jury for high-stakes decisions.** NBA ranking, send-eligibility, and collateral-acceptance run through Anthropic **and** OpenAI and are reconciled (D2, decided), accepting ~2× cost/latency. Extend `modelRouter.js`.
- **Capability gating through HubSpot.** Discover connected capabilities (note-taker, calling, email, scheduler) from HubSpot; gate NBA cards by what's present. Missing capability → "Connect X to HubSpot" CTA, not an execute button.
- **Composable layers meet at HubSpot.** No layer imports another's internals; the integration point is the HubSpot Deal.
- **No slop.** Adopt the canonical terminology and the v1 HubSpot-only boundary. Don't add abstractions, providers, or surfaces this PRD doesn't name.

### Error & Logging Convention
Severities: `fatal` (human needed) · `error` (one deal/action failed, loop continues) · `warning` (handled with fallback) · `info` (milestone). Every entry carries: ISO-8601 timestamp · severity · story id (e.g. `US-3.1`) · `tenantId` · `dealId` (if any) · message. LLM/jury steps additionally log both providers' `model_used`, usage, cost, and the reconciliation outcome.

---

## 7. Data Model (additions to Clarwiz Prisma — HubSpot is SOR, so store derived intel only)

| Model | Purpose | Key fields (snake_case columns) |
|-------|---------|-------------------------------|
| `Deal` | MOFU spine + TOFU→MOFU handoff target. **Pointer, not a mirror.** | `id`, `tenant_id`, `hubspot_deal_id` (unique per tenant), `name`, `cached_stage`, `cached_owner`, `cached_amount`, `cached_currency`, `stage_snapshot_at`, `origin_contact_campaign_id?` (TOFU handoff), `source` (`TOFU_TRANSITION`/`HUBSPOT_MQL`/`MANUAL`), `autopilot` (bool, default false), timestamps |
| `DealContext` | Hydrated derived-intel cache (the CONTEXT step). | `id`, `tenant_id`, `deal_id`, `data` (json), `source_refs` (json), `last_synced_at` |
| `DealInsight` | **The Heptapod bundle.** Deal- and company-scoped, same shape. Source of signals + NBA. | `id`, `tenant_id`, `scope` (`DEAL`/`COMPANY`), `deal_id?`, `company_id?`, `executive_summary` (json), `stakeholder_intelligence`, `value_intelligence`, `risk_intelligence`, `temporal_intelligence`, `competitive_intelligence`, `expansion_intelligence` (json each), `actionable_recommendations` (json — NBA source), `system_metadata` (json — confidence, data completeness), `model_used`, `provider_usage` (json), `provider_cost`, `created_at` |
| `DealSignal` | Transcript/email/stage-derived, **scored**. Drives NBA. Sibling of existing `BusinessUserSignal`. | `id`, `tenant_id`, `deal_id`, `scope`, `kind` (`CALL_TRANSCRIPT`/`EMAIL`/`STAGE_CHANGE`/`MEETING`/`NOTE`), `source`, `external_id`, `summary`, `score` (float), `signal_reference_id`, `occurred_at`, `raw` (json), `processed_for_nba_at`. `@@unique([tenant_id, source, kind, external_id])` |
| `TenantCapability` | HubSpot-discovered capabilities → gates NBA cards. | `id`, `tenant_id`, `capability` (`NOTE_TAKER`/`CALLING`/`EMAIL`/`MEETING_SCHEDULER`/…), `present` (bool), `detail` (json — which app), `discovered_at` |
| `NbaTemplate` | Catalog: action type + collateral binding + prompt scaffold. Mirrors Aura `nba-templates`. | `id`, `tenant_id?` (null = global), `action_type` (enum, closed set §8), `title`, `collateral_template_id?`, `prompt_scaffold` (text), `guardrails` (json), `enabled` |
| `NbaRecommendation` | Per-deal, ranked NBA card. | `id`, `tenant_id`, `deal_id`, `scope`, `action_type`, `title`, `score`, `signal_reference_id`, `payload` (json — draft params), `template_id`, `status` (`SUGGESTED`/`DRAFTED`/`EDITED`/`APPROVED`/`SENT`/`DISMISSED`/`FAILED`), `jury_result` (json — both models + reconciliation), `model_used`, `provider_usage`, `provider_cost`, `executed_at`, `hubspot_engagement_id?`, `created_at` |
| `Document` | Collateral record. Reuses `CommunicationLog` for send/track. | `id`, `tenant_id`, `deal_id`, `nba_recommendation_id?`, `type` (`MARKETING_COLLATERAL`/`SALES_COLLATERAL`/`BATTLECARD`/`EMAIL_ATTACHMENT`), `path` (`A`/`B`), `content_json` (json), `rendered_html` (text), `pdf_url?` (on demand), `brand` (json — cascade snapshot), `version`, `status` (`DRAFT`/`READY`/`SENT`), `model_used`, `provider_usage`, `provider_cost`, `created_at` |

**Additive to existing tables:** `Contact.mql_at?`, `Contact.promoted_deal_id?` (handoff markers). Reuse `TenantIcpContext` for ICP/value-prop framing (no change). New RBAC scopes: `mofu:view`, `deal:read`, `nba:run`, `nba:approve`, `collateral:generate`, `operator:dashboard`. ADMIN inherits all; MEMBER granted explicitly.

---

## 8. NBA action types (closed set)

`SEND_EMAIL` · `SEND_MARKETING_COLLATERAL` · `SEND_SALES_COLLATERAL` · `SCHEDULE_MEETING` · `CALL_WITH_SCRIPT` · `PREP_MEETING` · `UPDATE_CRM_CREATE_TASK` · `NOTIFY_TEAM`

The jury picks, ranks, and fills parameters for these; it cannot add new types. Each maps to one executor; `CALL_WITH_SCRIPT` is gated on a phone capability (and bounded by D5). Actions are composable (offer "draft email using both NBA actions" when two exist, per Aura).

---

## 9. Out of Scope

- **Multi-connector / second SOR** — deferred. v1 is HubSpot-only behind the adapter seam. No Salesforce/Pipedrive code.
- **CRM mirror / general two-way field sync** — Clarwiz stores derived intel and writes the actions it owns.
- **Automated dialer / calling** — Clarwiz has no calling today; v1 is at most generate-and-log a script (D5).
- **Billing, subscription, admin of tenants/users** — Clarwiz already has its own.
- **Aura deferred surfaces** — CRM bulk import + chat analysis, rep-level User Intelligence, Tailspin onboarding flow. Recognized, post-v1.
- **Aura's scrape / extension-without-token path** — Clarwiz is HubSpot-connected only.
- **Authoring ICP / Brand Foundry content** — MOFU consumes `TenantIcpContext`.

---

## 10. Phases & Epics (adopts the canonical build order — all in scope)

> Build in this order because each step feeds the next. Stop for review at each phase boundary.

**Phase A — Spine & context.** *Nothing decides without context.*
- Epic 1: `Deal` + `DealContext` + HubSpot read adapter (hybrid hydrate: cache intel, read volatile fields live).
- Epic 2: `DealSignal` ingestion (transcript/email/stage) + scoring.

**Phase B — Brain.** *Signals become ranked actions.*
- Epic 3: Insight bundle compute (Heptapod six dimensions, deal + company scope) → `DealInsight`.
- Epic 4: NBA brain — `actionable_recommendations` → ranked `NbaRecommendation` via the **dual-model jury**.
- Epic 5: Capability discovery + NBA card gating against HubSpot.

**Phase C — Execution & collateral.** *Actions get done, through HubSpot.*
- Epic 6: Universal execution rails (draft → editor → approve gate → send via HubSpot → tracked) + the simple executors (`SEND_EMAIL`, `PREP_MEETING`, `UPDATE_CRM_CREATE_TASK`, `NOTIFY_TEAM`, `SCHEDULE_MEETING`).
- Epic 7: Path A collateral (code-template registry, no LLM) + the three-layer renderer + brand cascade.
- Epic 8: Path B collateral (multi-step LLM pipeline as a **queued job**) + conversational re-enrichment + versions.

**Phase D — Surfaces, transition & orchestration.** *Make it reachable and keep it looping.*
- Epic 9: Deal Insights page + Company Insights page (the two NBA surfaces over the bundle).
- Epic 10: Operator dashboard (operator-level view of what's happening + what to trigger).
- Epic 11: Slack chat surface (query a deal, see NBA, approve).
- Epic 12: **Transition layer** — prospect → opportunity creates Company/Contact/Deal in HubSpot + `Deal` pointer + team notification (the TOFU→MOFU handoff; also standalone).
- Epic 13: Recompute orchestration — HubSpot webhooks (transcript landed / reply / stage change) + "suggest now" + copilot/autopilot.

---

## 11. User Stories

> Contract-defining stories are fully specified. Supporting stories are compact (persona/priority/depends/constraints + acceptance criteria) and Claude Code expands them to the same shape before building.

### US-1.1 — Hybrid-hydrate a deal from HubSpot **(contract)**
**As a** the context hydrator
**I want to** build a `DealContext` by caching slow intel and reading volatile HubSpot fields live, behind the single `SorAdapter` interface
**So that** the NBA brain reasons over fresh deal state without Clarwiz mirroring the CRM
**Priority:** Must Have · **Depends on:** the additive migration (lands first, Phase A start) · **Constraints:** Volatile fields (stage, owner, amount, engagement timeline) are **never** persisted as truth — read live each hydrate. Slow intel cached on `DealContext.data` with `last_synced_at`. All HubSpot access via `SorAdapter` (HubSpot impl only). Not-connected → structured no-op, no throw.

**Input:** `{ tenantId, hubspotDealId }`
**Output:** `{ dealId, context:{ live:{stage,owner,amount,timeline}, cached:{...} }, lastSyncedAt }`

✅ **Positive:** First hydrate creates `Deal` pointer + `DealContext`; live fields come from HubSpot, cached intel persisted.
✅ **Positive:** Re-hydrate refreshes live fields every call and only re-pulls slow intel when stale.
❌ **Negative:** HubSpot 5xx/timeout → retry (exp backoff, max 3) then return last cached context + `warning` "stale_context"; brain still runs.
❌ **Negative:** HubSpot token missing/expired → `{ ok:false, reason:"sor_not_connected" }`, surfaced as a connect CTA; no crash.
⚠️ **Non-functional:** No volatile field appears as a stored source of truth (grep `cached_stage` only used as a snapshot, never read as authoritative for decisions).

**Verification:** (1) hydrate a sandbox deal, confirm pointer+context and live stage matches HubSpot; (2) change stage in HubSpot, re-hydrate, confirm new stage without a full re-pull; (3) mock HubSpot 500, confirm stale-context fallback.

### US-2.1 — Ingest and score deal signals **(contract)**
**As a** the signal ingester
**I want to** turn HubSpot transcripts/emails/stage-changes into scored `DealSignal` rows
**So that** the NBA brain ranks actions off real, weighted signals
**Priority:** Must Have · **Depends on:** US-1.1 · **Constraints:** Dedupe by `(source, kind, external_id)`. Score each signal (recency × type-weight × intent). Never fabricate a signal id. Bound volume (most-recent N per kind).

✅ **Positive:** A landed transcript becomes a `DealSignal` with summary + score + `signal_reference_id`.
✅ **Positive:** Re-ingest is idempotent (no duplicate rows).
❌ **Negative:** Malformed/empty payload → `warning`, skip, continue.
❌ **Negative:** Note-taker not connected → no transcript signals, `coverage:false`; other signals still ingest.
⚠️ **Non-functional:** Scoring is deterministic and unit-tested independent of the LLM.

### US-3.1 — Compute the Heptapod insight bundle (deal + company) **(contract)**
**As a** the intelligence engine
**I want to** analyze deal/company data into the fixed dimensional bundle (executive summary + 6 intelligences + `actionable_recommendations` + metadata)
**So that** the AE reads a complete picture and signals + NBA fall out of one coherent object
**Priority:** Must Have · **Depends on:** US-1.1, US-2.1 · **Constraints:** Same shape for `scope=DEAL` and `scope=COMPANY`. The six dimensions are stakeholder / value / risk / temporal / competitive / expansion. `system_metadata` carries confidence + data completeness. Persist as `DealInsight`; cache and recompute on new signals. High-stakes acceptance runs the **dual-model jury**.

**Output (shape):**
```
{ executive_intelligence_summary, heptapod_dimensional_analysis:{ stakeholder, value, risk, temporal, competitive, expansion },
  actionable_recommendations:[...], system_metadata:{ confidence, data_completeness } }
```
✅ **Positive:** Produces all six dimensions + recommendations + metadata for a deal; company scope renders the same tabs (Overview/Stakeholders/Value/Risks/Timeline/Competitive/Expansion).
❌ **Negative:** Thin data → low `data_completeness`, dimensions flagged best-effort, **no hallucinated specifics**.
❌ **Negative:** One LLM provider errors → jury degrades to single-model with a `warning`; bundle still returns.
⚠️ **Non-functional:** Bundle cached; recompute is debounced so a burst of signals doesn't trigger N full recomputes.

### US-4.1 — Rank NBA candidates with the dual-model jury **(contract)**
**As a** the NBA brain
**I want to** derive NBA candidates from signals (`{action_title, signal_score, signal_reference_id}`), constrain them to the closed action set, and rank via Anthropic + OpenAI reconciled
**So that** the AE sees the best next step, grounded in a specific signal, not a guess
**Priority:** Must Have · **Depends on:** US-3.1, §8 catalog · **Constraints:** Candidates come from `actionable_recommendations`; type ∈ closed set; ranked by `signal_score`; each carries `signal_reference_id`. Persist as `NbaRecommendation` (`SUGGESTED`) with `jury_result`, cost, usage. Fork (do not reuse) TOFU `decideNextAction` — this is deal-centric, that is prospect-centric.

✅ **Positive:** After a discovery transcript, the top card addresses a signal from that call and cites its `signal_reference_id`.
✅ **Positive:** Two strong actions → offers a composed "draft email using both" option.
❌ **Negative:** Jury disagreement → apply the D4 rule (default: agreement-or-escalate for sends, higher-confidence for ranking) and record both opinions in `jury_result`.
❌ **Negative:** Both providers error → return last persisted cards + `error`; deal never left blank.
⚠️ **Non-functional:** Jury cost/latency (~2×) logged per recommendation; cheap pre-filter via `modelRouter` before the jury.

### US-5.1 — Discover HubSpot capabilities and gate NBA cards
**Persona:** the capability gate · **Priority:** Must Have · **Depends on:** US-1.1 · **Constraints:** Query HubSpot for connected note-taker/calling/email/scheduler → `TenantCapability`. A card whose executor needs a missing capability renders a **"Connect X to HubSpot" CTA** instead of an execute button.
✅ Email connected → `SEND_EMAIL` cards are executable. ❌ Phone absent → `CALL_WITH_SCRIPT` shows the connect CTA, never an execute button. ⚠️ Capabilities re-discovered on a schedule + on webhook hints.

### US-6.1 — Universal execution rails with mandatory approve gate **(contract)**
**As a** the action executor
**I want** every action type to ride `card → draft → editor → approve → send via HubSpot → tracked`, with only the draft generator differing
**So that** the AE owns every send and one set of rails covers email, collateral, script, and CRM updates
**Priority:** Must Have · **Depends on:** US-4.1, US-5.1 · **Constraints:** Mandatory approve gate for any outbound (`SEND_*`, `SCHEDULE_MEETING`, `NOTIFY_TEAM` external). Send/track through HubSpot, logged to `CommunicationLog`. Idempotent per `NbaRecommendation.id` (no double-send). Status flows `SUGGESTED→DRAFTED→EDITED→APPROVED→SENT`/`FAILED`.

✅ **Positive:** Approving a `SEND_EMAIL` sends via HubSpot, stores `hubspot_engagement_id`, status `SENT`, and the engagement feeds the next NBA.
✅ **Positive:** Same rails: a `UPDATE_CRM_CREATE_TASK` creates the HubSpot task; a `PREP_MEETING` produces an internal brief (no send).
❌ **Negative:** Outbound without approval → `403`, status stays `DRAFTED`/`EDITED`.
❌ **Negative:** HubSpot send fails → status `FAILED`, reason stored, surfaced with retry; no partial side effect.
❌ **Negative:** Re-approve an already-`SENT` action → no-op returning the prior engagement id.
⚠️ **Non-functional:** Every execution writes an audit line (actor, surface, cost where LLM involved).

### US-7.1 — Path A: marketing collateral via code-template registry
**Persona:** the collateral engine (Path A) · **Priority:** Should Have · **Depends on:** US-6.1 · **Constraints:** Rebuild Pilot's `render(data, brand) → HTML` pattern natively: fixed template + defaults + client-field mapping + overrides, **no LLM**. Three-layer renderer (structure / style / content), brand cascade defaults → tenant → client. Output a `Document` (`path=A`).
✅ Generates a branded one-pager from a fixed template + deal fields; editable, approvable, sendable on the US-6.1 rails. ❌ Missing client field → falls back to default + `info`, never blank token. ⚠️ Deterministic — same inputs produce the same HTML.

### US-8.1 — Path B: sales collateral as a queued LLM pipeline
**Persona:** the collateral engine (Path B) · **Priority:** Should Have · **Depends on:** US-6.1 · **Constraints:** Rebuild Pilot's `resolve → research → enrich → plan → generate → QC → assemble` pipeline natively as a **queued job** (exceeds serverless request limits). Conversational re-enrichment + versions (HeyParrot/Aura pattern). Acceptance gated by the jury. Output a `Document` (`path=B`, versioned). Battlecard is a Path B template.
✅ Produces a deal-specific sales asset with versions; chat re-enrich re-runs the pipeline and bumps the version. ❌ Job timeout/failure → marked `FAILED`, retryable, AE notified; no half-written `Document`. ⚠️ Generation cost recorded; PDF rendered on demand only (D3).

### US-9.1 — Deal Insights page & US-9.2 — Company Insights page
**Persona:** an Account Executive (tenant MEMBER) · **Priority:** Must Have · **Depends on:** US-3.1, US-4.1, US-6.1 · **Constraints:** Chakra UI. Both render the Heptapod bundle: Overview + the six dimension tabs + Signals + ranked NBA cards (with execute/approve on the US-6.1 rails). Deal scope is `getDealInsights`; company scope is `getCompanyInsights` (same shape). RBAC-gated.
✅ AE opens a deal, reads the six dimensions, sees score-ranked NBA cards each citing a signal, and executes in one approval. ❌ A failed execution shows an inline error + retry, never a blank panel. ⚠️ Tenant-isolated; MEMBER without `nba:approve` is read-only.

### US-10.1 — Operator dashboard
**Persona:** a Clarwiz operator · **Priority:** Must Have · **Depends on:** US-4.1, US-6.1 · **Constraints:** Operator-level view of what's happening across deals (signals landing, bundles computing, NBA queue, executions, failures) and **what to trigger** (recompute, suggest-now, retry, push a deal forward). Read + trigger only — no bypass of the approve gate for outbound.
✅ Operator sees live deal/NBA/execution state and can trigger a recompute or suggest-now for a deal. ❌ Triggering an outbound still routes through the AE approve gate. ⚠️ Actions are audit-logged with the operator identity.

### US-11.1 — Slack chat surface
**Persona:** an AE in Slack · **Priority:** Should Have · **Depends on:** US-4.1, US-6.1 · **Constraints:** Slash command + interactive buttons to query a deal's NBA and approve. Verify Slack signing secret; map Slack user → Clarwiz user/rights; execute through US-6.1.
✅ `/clarwiz deal Acme` returns ranked NBA with Approve buttons; Approve executes and confirms in-thread. ❌ Unverified signature → `401`. ❌ Unmapped/unauthorized Slack user → ephemeral "not authorized". ⚠️ Acks within Slack's 3s window, then follows up.

### US-12.1 — Transition: prospect → opportunity **(contract)**
**As a** the transition layer
**I want to** create Company + Contact + Deal in HubSpot and the Clarwiz `Deal` pointer, then notify the team, when a prospect becomes an opportunity
**So that** the deal exists in the SOR with zero manual entry and MOFU can pick it up
**Priority:** Must Have · **Depends on:** US-1.1, US-6.1 (notify) · **Constraints:** Fires from a TOFU qualification (`ContactCampaign.qualifiedAt`, hook after `qualifyContact.js`) **or** a manual/HubSpot promotion — runs standalone either way. **Idempotent:** dedupe company by domain, contact by email, deal by existing `hubspot_deal_id`; never a second `Deal` for the same `(contact, campaign)`.

**Output:** `{ dealId, hubspotDealId, externalRef:{ companyId, contactId, dealId }, notified:true }`
✅ **Positive:** Creates the three HubSpot records + `Deal` pointer (`source=TOFU_TRANSITION`, `origin_contact_campaign_id` set), sets `Contact.mql_at`/`promoted_deal_id`, notifies the team channel with a deep link.
✅ **Positive:** Manual promotion of a non-TOFU contact works identically (`source=MANUAL`).
❌ **Negative:** Re-run for the same prospect → returns the existing `dealId`, no new HubSpot records.
❌ **Negative:** HubSpot write fails mid-way → partial `externalRef` saved, retry queued, no duplicate company on retry; team still notified best-effort.
⚠️ **Non-functional:** < 10s p95; a notification failure never blocks the HubSpot writes.

### US-13.1 — Recompute orchestration (webhooks + suggest-now + copilot/autopilot)
**Persona:** the MOFU orchestrator · **Priority:** Must Have · **Depends on:** US-2.1, US-4.1 · **Constraints:** HubSpot webhooks (transcript landed / reply / stage change) verify the per-tenant token, ingest a `DealSignal`, and re-trigger the brain for that deal. On-demand "suggest now" exists. Copilot (default): AE approves all. Autopilot: auto-execute only low-risk internal actions (`PREP_MEETING`, `UPDATE_CRM_CREATE_TASK`, `NOTIFY_TEAM` internal); outbound always holds for approval (D7).
✅ A new transcript posts a signal and recomputes NBA for the matched deal. ❌ Bad/missing webhook token → `401`, no processing. ❌ Unmatchable event → stored unlinked + `warning`. ⚠️ Recompute is debounced; webhook returns 200 fast and processes async.

---

## 12. Open Decisions

| # | Decision | Status | Recommended default for v1 (confirm before building) |
|---|----------|--------|------------------------------------------------------|
| D1 | Context source | **Decided** | Hybrid — cache intel, read CRM fields live. |
| D2 | LLM court | **Decided** | Always dual-model jury for high-stakes (NBA rank, send-eligibility, collateral acceptance). |
| D3 | PDF on serverless | **Open** | External render service (cleanest on Vercel); fallback `@sparticuz/chromium`; client-side `@react-pdf`/`html2pdf` as Aura does. PDF rendered on demand only. |
| D4 | Jury disagreement rule | **Open** | Outbound/send-eligibility → **agreement-or-escalate to AE**; ranking → higher-confidence model wins. Record both opinions. |
| D5 | Calling semantics | **Open** | v1 = generate + log a `CALL_WITH_SCRIPT` script only (no dialer); gate the card on a phone capability. |
| D6 | Marketing vs sales template taxonomy | **Open** | Two separate catalogs (marketing = Path A, sales = Path B); document where marketing templates are authored/stored. |
| D7 | Approve-gate granularity | **Open** | v1 = per-send approval always; autosend allowlist for low-risk internal actions only, later. |

---

## 13. Known Gaps & Risks

| Gap | Description | Severity | Resolution Path |
|-----|-------------|----------|-----------------|
| G-1 | NBA brain is deal-centric; closest pattern is prospect-centric TOFU `decideNextAction` | Medium | **Fork**, don't reuse; share only helpers (modelRouter, openaiClient) |
| G-2 | Capability discovery + gating against HubSpot is net-new | Medium | Build `TenantCapability` discovery early (Epic 5); fail closed (gate → CTA) when unknown |
| G-3 | Calling not built in Clarwiz (TOFU `executionRules` marks it not-built) | Medium | Scope `CALL_WITH_SCRIPT` to script-only per D5 until a dialer decision |
| G-4 | Path B latency/token use exceeds serverless request limits | High | Run Path B as a **queued job**, never a request handler |
| G-5 | PDF rendering on Vercel serverless | Medium | Decide D3; render on demand only |
| G-6 | Heptapod generation logic isn't in aura-frontend (contract inferred from client + companyInsights/README) | Medium | Rebuild server-side from the bundle contract in §3/US-3.1; validate against the inferred shape |
| G-7 | Jury ~2× cost/latency at scale (recompute on every signal) | Medium | Cheap `modelRouter` pre-filter + debounced recompute + cache the bundle |
| G-8 | Transcript/email PII leaving the tenant to LLM providers | High | Summarize/redact in context build; keep raw out of logs; confirm data-processing posture before enabling |

---

## 14. Definition of Done

**Story-level:** all positive + negative + non-functional ACs pass · structured logs per §6 · canonical shapes honored · HubSpot not-connected and 4xx/5xx handled without throwing · tenant-scoped · jury/LLM cost recorded.

**PRD-level:**
- One additive Prisma migration applies cleanly; TOFU tables untouched; down-migration works.
- The core loop runs end-to-end in a HubSpot sandbox: hydrate → signals → Heptapod bundle → NBA (jury) → approve → send via HubSpot → engagement recomputes NBA.
- **Each layer demonstrably runs standalone:** MOFU from a HubSpot MQL with no TOFU; Transition on a manual promotion; TOFU unchanged.
- No reference codebase (Pilot/Aura/HeyParrot) is imported or called at runtime (grep clean); only HubSpot + LLM providers are external runtime calls.
- No second-SOR/provider code exists (HubSpot-only v1); all SOR access goes through the single `SorAdapter`.
- Approve gate enforced on every outbound; capability gating renders CTAs for missing capabilities.
- Open decisions D3–D7 resolved (or explicitly deferred with the recommended default) before the affected epic ships; G-4 (Path B queued) and G-8 (PII) resolved before enabling Path B / external sends in prod.
