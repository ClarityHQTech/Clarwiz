# Claude Code Kickoff Prompt — Build Clarwiz MOFU (+ Transition) on HubSpot-as-SOR

> Paste below into Claude Code from the `clarwiz` repo root. Add the PRD to the repo first (e.g. `docs/Clarwiz-MOFU-PRD.md`).

---

You are adding two layers to this repo (an existing Next.js 14 / JS / Prisma / Postgres / OpenAI multi-tenant GTM platform): the **Transition** layer and the **MOFU** layer ("NBA for Account Executives"). The TOFU campaign engine already exists and stays unchanged except one additive transition trigger. The full spec is **`docs/Clarwiz-MOFU-PRD.md`** — read it completely before writing code. It is the source of truth; this message is how to execute it without producing slop.

## The one-paragraph mental model
The product is three layers — **TOFU → Transition → MOFU** — that each run **standalone or together**. They meet at the **HubSpot Deal**, not by importing each other. **HubSpot is the system of record and the execution substrate.** Clarwiz is the intelligence layer the AE works inside: it reads context from HubSpot, computes the deal's intelligence (the Heptapod bundle → signals → ranked NBA), and writes approved actions back to HubSpot. Clarwiz stores **derived intelligence only** — never a CRM mirror.

## Rule 0 — learn, do not integrate (read this twice)
Pilot, Aura, and HeyParrot are **reference codebases, not dependencies.** You will read their patterns and **rebuild them natively** in Clarwiz (JS / Next / Prisma). You must **never** import their packages, call them at runtime, or API into them.
- **Pilot** → the document/collateral engine (renderer, template registry, multi-step pipeline). Rebuild in JS.
- **Aura** → the NBA model (signal-derived, score-ranked, template-executed), the Heptapod six-dimension insight bundle, and the collateral edit/version UX. Rebuild.
- **HeyParrot** → the conversational collateral-enrichment flow. Rebuild.
The **only** external runtime integrations are **HubSpot** and **LLM providers (Anthropic + OpenAI)**. Everything else is owned, in-repo Clarwiz code. If you ever write `import ... from '@ariya/...'` or fetch an Aura/Pilot/HeyParrot endpoint, stop — that's the error.

## Step 0 — read the repo before changing it
Map the patterns you will mirror and post a short findings note (≤1 page) confirming real paths before any code:
- `prisma/schema.prisma` — model/enum style; `Tenant`, `Contact`, `ContactCampaign`, `CommunicationLog`, `TenantIcpContext`, `BusinessUserSignal`, `*Integration`, `IntegrationWebhook`.
- `src/lib/execution/` — `decideNextAction.js` (you will **fork** this into a deal-centric NBA brain, not reuse it), `executionRules.js`, `modelRouter.js` (you will **extend** to a cross-provider jury), `qualifyContact.js` (transition hooks in after it).
- `src/lib/push/` — the "integration not connected → no-op, log planned, don't throw" pattern. The `SorAdapter` not-connected path mirrors it.
- `encryptSecret.js`, `openaiClient.js`, the HubSpot OAuth/token storage, the webhook-token pattern, `authContext.js`/`permissions.js`/`cronAuth.js`, and `package.json` scripts (mirror the TOFU cron for any MOFU cron).

If the PRD conflicts with the actual code, **stop and flag it** — update the PRD's Assumptions/Known Gaps rather than silently diverging.

## Non-negotiable architecture rules
1. **HubSpot is SOR; store derived intel only.** Read volatile fields (stage, owner, amount, engagement timeline) **live** every hydrate; cache slow intel (transcript summaries, signals, insight bundle, NBA, collateral). No CRM mirror.
2. **One adapter seam, HubSpot-only in v1.** All SOR access goes through a single `SorAdapter` interface with exactly **one** implementation (HubSpot). Do **not** write Salesforce/Pipedrive code or any second adapter. The brain reads through the interface so a second SOR is addable later untouched.
3. **Composable layers meet at HubSpot.** No layer imports another's internals. MOFU must run from a HubSpot MQL with no TOFU present; Transition must run on a manual promotion with no MOFU; TOFU keeps working alone. Cross-layer touchpoints are HubSpot reads/writes or `Deal`-pointer references only.
4. **Closed NBA action set.** `SEND_EMAIL`, `SEND_MARKETING_COLLATERAL`, `SEND_SALES_COLLATERAL`, `SCHEDULE_MEETING`, `CALL_WITH_SCRIPT`, `PREP_MEETING`, `UPDATE_CRM_CREATE_TASK`, `NOTIFY_TEAM`. The jury ranks and parameterizes; it never invents a type. Each type maps to one executor.
5. **Universal execution rails + mandatory approve gate.** Every action: `card → draft → editor → approve → send via HubSpot → tracked`. Only the draft generator differs by type. The AE owns every outbound send.
6. **Dual-model jury for high-stakes** (NBA ranking, send-eligibility, collateral acceptance): run Anthropic + OpenAI, reconcile, record both opinions. Extend `modelRouter.js`. Cheap pre-filter before the jury.
7. **Capability gating through HubSpot.** Discover connected note-taker/calling/email/scheduler → `TenantCapability`; gate cards. Missing capability → "Connect X to HubSpot" CTA, not an execute button.
8. **Additive only.** One new Prisma migration; no TOFU column dropped/retyped; working down-migration. The only TOFU change is the transition trigger hook after `qualifyContact.js`.
9. **Multi-tenant isolation.** Every query scoped by `tenantId`; cross-tenant access returns 404.
10. **No slop.** Use the PRD's exact terms (Heptapod bundle, `DealInsight`, `NbaRecommendation`, `NbaTemplate`, Path A/B, jury, capability gating). Don't add providers, abstractions, or surfaces the PRD doesn't name. v1 is HubSpot-only — keep it that way.

## Build order (PRD §10 — all in scope; stop for review at each phase)
- **Phase A — Spine & context:** `Deal` + `DealContext` + HubSpot read adapter (hybrid hydrate) → `DealSignal` ingestion + scoring. **Checkpoint A:** a sandbox deal hydrates (live stage from HubSpot, cached intel) and a transcript becomes a scored signal.
- **Phase B — Brain:** Heptapod insight bundle (`DealInsight`, deal + company scope) → NBA brain (ranked `NbaRecommendation` via dual-model jury) → capability discovery + card gating. **Checkpoint B:** a deal shows the six dimensions + score-ranked NBA cards, each citing a signal; cards gate on HubSpot capabilities.
- **Phase C — Execution & collateral:** universal rails + simple executors → Path A (code-template marketing collateral + renderer + brand cascade) → Path B (sales collateral as a **queued job** + chat-enrich + versions). **Checkpoint C:** approve an email → sends via HubSpot, tracked; a marketing one-pager renders; a sales asset generates as a job.
- **Phase D — Surfaces, transition, orchestration:** Deal Insights page + Company Insights page → operator dashboard → Slack → **Transition** (Company/Contact/Deal in HubSpot + `Deal` pointer + notify) → recompute orchestration (HubSpot webhooks + suggest-now + copilot/autopilot). **Checkpoint D:** end-to-end from the UI and Slack; a new transcript webhook recomputes NBA; transition provisions a deal idempotently.

## Open decisions — confirm before building the affected part
D3 (PDF on serverless), D4 (jury-disagreement rule), D5 (calling = script-only?), D6 (marketing vs sales template taxonomy), D7 (approve-gate granularity). The PRD §12 has a recommended default for each — **use it only if I don't respond**; otherwise pause and ask. D1 (hybrid) and D2 (jury) are decided.

## Testing & verification (PRD §14)
- Unit-test the deterministic pieces: signal scoring, capability gating, brand cascade, the `SorAdapter` HubSpot mapping (both directions).
- Mock HubSpot 429/5xx/timeout → assert retries + structured fallback (stale-context, not crash). Mock one LLM provider down → jury degrades to single-model with a warning.
- End-to-end in a HubSpot sandbox: hydrate → signals → bundle → NBA (jury) → approve → send via HubSpot → engagement recomputes NBA.
- Prove composability: MOFU from a HubSpot MQL with no TOFU; Transition on a manual promotion; TOFU suite still green.
- Grep gates: no Pilot/Aura/HeyParrot import or runtime call; no second-SOR/provider name outside the (single) HubSpot adapter.
- Run the existing test suite + lint after each phase; never break TOFU.

## How to work
- Keep a running TODO mapped to PRD story IDs (US-1.1, US-2.1, …); update as you go.
- Small, reviewable commits per story, messages referencing the story id.
- Unknown tenant-specifics (HubSpot pipeline ids, channel ids, ICP source) come from config / `TenantIcpContext` — never hardcode; surface a clear "missing config" error.
- Ask me before: enabling Path B in prod, enabling any outbound autosend, adding a dependency, or anything touching live customer data.

Start with **Rule 0 + Step 0** — read the PRD and the repo, then post your findings note and your Phase A plan before writing code.
