# MOFU AE-Assist — Ultraplan (Executable)

> Companion to `MOFU_ROADMAP.md`. This is the build sheet: ordered tasks, owners by repo,
> file targets, dependencies, and acceptance criteria. Goal = complete flow (MQL → deal → close).

## 0. Conventions

- **Repos:** `clarwiz` (brain + ToFu), `pilot` (collateral), `aura-frontend` (new UI).
- **Identity:** everything keyed by HubSpot `dealId` / `companyId` / `contactId`.
- **Migration style:** strangler — Clarwiz can forward not-yet-ported endpoints to the old aura
  backend so nothing breaks mid-migration.
- **Task IDs:** `C#` Clarwiz · `P#` pilot · `U#` UI · `X#` cross-cutting.

## 1. Build order (dependency graph)

```
X1 contracts ─┬─> C1 HubSpot read ─> C2 deal insights ─> C3 company insights ─> C4 NBAs ─> C5 signals
              ├─> P1 clarwiz tenant ─> P2 unified directory ─> P3 MOFU-context gen ─> P4 chat edit/share
              └─> U1 app shell ─> U2 dashboard widgets ─> U3 reuse aura components ─> U4 global chat
C2 ──> U2   |   P3 <── C2/C3 (context packet)   |   C6 MQL→HubSpot write bridges ToFu→MOFU
Milestones: M1 deal view live · M2 collateral from context · M3 both flows E2E
```

## 2. Foundational contracts (X — do first, no app code)

### X1. MOFU API surface (Clarwiz exposes, UI + pilot consume)
Reference: `aura-frontend/AURA_SERVICES.md` + `aura-frontend/src/service/Api.js`.
Define request/response for, at minimum:
- `POST /api/insights/deal-service-bundle` → `{ score, briefing, riskSignals[], nbas[], playbook[] }`
- `POST /api/insights/company-service-bundle` → 10-tab payload (overview, stakeholders, value, risks, actions, timeline, competitive, expansion, research, signals)
- `POST /api/features/nba-execution` → `{ emailDraftHtml, collateralRequest? }`
- `GET  /api/signals/by-source?source_id=` → `{ signals[] }`
- `POST /api/features/webresearch` → `{ research }`
- `POST /api/chat` → streamed answer over HubSpot context (new)
- `POST /api/collateral/generate` → proxies to pilot (see X2)

**Acceptance:** one markdown/OpenAPI doc in `clarwiz` listing every endpoint + JSON shapes. UI and pilot teams build against it.

### X2. Collateral-context (ontology) packet — Clarwiz → pilot
The single object Clarwiz sends pilot to generate parrot-grade collateral:
```jsonc
{
  "tenant": "clarwiz",
  "hubspot": { "dealId", "companyId", "contactIds": [] },
  "stage": "mql|discovery|proposal|closing",
  "company": { "name", "industry", "size", "intel": {…}, "insights": {…} },
  "contacts": [{ "name", "role", "influence", "notes" }],
  "deal": { "amount", "stage", "lastActivity" },
  "intent": "first_touch|follow_up|proposal|battlecard|case_study",
  "memory": { "clientLearnings": [], "tenantHeuristics": [] }
}
```
**Acceptance:** schema committed in both `clarwiz` and `pilot`; sample fixture both sides validate against.

## 3. Clarwiz — the brain

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| C1 | HubSpot read integration (deals/companies/contacts/activity) | new `src/lib/hubspot/*`, API routes under `src/app/api/hubspot/` | X1 | Given a `dealId`, returns amount + last activity + company + contacts. |
| C2 | Port **deal insights** service (prompts from aura backend) | `src/app/api/insights/deal-service-bundle/route.js`, `src/lib/insights/deal.js` | C1 | Returns score+briefing+risks+NBAs for a real HubSpot deal. |
| C3 | Port **company insights** (10 tabs) | `src/app/api/insights/company-service-bundle/route.js`, `src/lib/insights/company.js` | C1 | All 10 tab sections populated. |
| C4 | Port **NBA** templates + execution → email draft | `src/app/api/features/nba-execution/route.js`, `src/lib/nba/*` | C2,C3 | NBA → editable email draft HTML; optional collateral request emitted. |
| C5 | Port **signals** + web research | `src/app/api/signals/*`, `src/app/api/features/webresearch/route.js` | C1 | Signal badges + research text returned. |
| C6 | **MQL → HubSpot write** on `QUALIFIED` (ToFu→MOFU bridge) | extend `src/lib/execution/qualifyContact.js`, new `src/lib/hubspot/upsertLead.js` | C1 | A qualified Clarwiz contact appears as a HubSpot lead/deal. |
| C7 | **Global chat** over HubSpot context | `src/app/api/chat/route.js`, `src/lib/chat/*` | C1–C5 | AE asks "what's next on Acme?" → grounded answer using live data. |
| C8 | Strangler proxy for un-ported endpoints | `src/app/api/[...]/route.js` fallback | X1 | Unknown `/api/*` forwards to old aura backend, returns its response. |

## 4. pilot — unified collateral

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| P1 | Provision **clarwiz as a tenant** | seed via `packages/core` tenant; `tenants` row + brand kit | X2 | `tenantId=clarwiz` resolves; scoped queries work. |
| P2 | **Unified collateral directory** (generalize HR templates → GTM) | `packages/templates/src/templates/*`, tag marketing+sales | P1 | One listing returns sales + marketing collateral for clarwiz tenant. |
| P3 | **MOFU-context generation endpoint** (consumes X2 packet) | new route in `packages/transport-api/src/routes/`, `packages/core/src/documents/engine/` | X2,P2 | POST context packet → generated doc (JSON+HTML) with real, contextual content. |
| P4 | **Chat edit + templatize + share/PDF** | reuse `edit_document`, `fix_document_styling`, `/documents/:id/pdf`, versions | P3 | Edit collateral via chat; get share URL + PDF; version history intact. |

## 5. New UI (aura-frontend repo)

| ID | Task | Files / area | Depends | Acceptance |
|----|------|--------------|---------|------------|
| U1 | Clean **app shell** + point API base at Clarwiz | new `src/app-mofu/` or refactor `src/App.js`, env `REACT_APP_API_URL` | X1 | Shell loads, auth works, calls Clarwiz. |
| U2 | **Composable dashboard** (configurable widgets: open leads/deals, company intel, NBAs, collateral, contacts) | new `src/pages/Dashboard/*` + widget registry | C2,U1 | User can choose which widgets show; company view renders live data. |
| U3 | **Reuse aura components** as widgets | import existing `DealInsights2`, `CompanyTest` tabs, NBA cards, `TailspinCollateral` | U2 | Proven panels render inside new shell. |
| U4 | **Global chat** panel | reuse `CollateralChatbot` pattern → `/api/chat` | C7,U1 | Chat answers grounded in AE's HubSpot world. |

## 6. Milestones / demo checkpoints

- **M1 — Deal view live:** C1+C2+U1+U2 → open a HubSpot deal, see real insights + NBAs in the new dashboard.
- **M2 — Collateral from context:** C2/C3 + X2 + P3 → click NBA → pilot generates contextual collateral, viewable/editable.
- **M3 — Both flows E2E:**
  - Flow A: C6 → MQL becomes HubSpot deal → first-touch NBA → collateral → demo scheduled.
  - Flow B: existing deal → company intel (C3) → NBA (C4) → sales collateral (P3) → follow-up → close.

## 7. Inputs still needed
- **aura backend prompts** for C2–C5 (user providing). Until then: reconstruct from `AURA_SERVICES.md` (lossy).
- **HubSpot credentials/scopes** for live read + MQL write (C1, C6).
- **Decision:** support extension-only (`/api/withoutToken/*`) mode, or app-installed only for the hackathon? (affects C2–C5 surface area).
