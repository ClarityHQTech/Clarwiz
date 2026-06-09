# MOFU AE-Assist — Hackathon Roadmap

> Middle-of-funnel "AE assist": from MQL → deal → close. Stitches three existing systems
> into one Account-Executive cockpit, with **HubSpot as the source of truth**.

## 1. Problem & flow

An Account Executive's day after an MQL lands in HubSpot. Two flows, one continuous funnel:

- **Flow A — MQL → Deal:** AE approaches the lead with full context + the right collateral
  (call/email). Next-best-actions drive toward a scheduled demo. On demo scheduled, the
  lead becomes a **deal**.
- **Flow B — Deal → Close:** existing or newly-created deal. Pull company intel/insights,
  generate sales collateral, run pre/post-meeting NBAs (follow-ups, scheduling, technical
  clarifications) until **closed**.

Scope for the hackathon = **the complete flow** (A and B end-to-end).

## 2. Components

| # | Component | What it is |
|---|---|---|
| 1 | **SOR** | HubSpot — leads, deals, contacts, companies, stages. Canonical truth. |
| 2 | **Deal Assist** | Integrations (HubSpot + meeting tools), pre/post-meeting intelligence, NBAs, chat. |
| 3 | **Collateral Generation** | One unified directory (marketing + sales); intelligent selection + send-out. |
| 4 | **Visual Dashboard** | Company-level view: open leads/deals, intel + insights, company NBAs, collateral, contacts. |
| 5 | **Global Chat** | Context-aware over the AE's whole HubSpot world. |

## 3. Architecture (locked)

| Concern | Owner | Stack today |
|---|---|---|
| Source of truth | **HubSpot** | — |
| MOFU brain: deal/company insights, NBAs, signals, web research, global chat | **Clarwiz** | Next.js 14, Prisma/Postgres, OpenAI |
| Unified collateral: generation + editing + templatizing + single directory + chat | **pilot** | TS/Hono/Postgres/Drizzle, Claude |
| AE experience: **new clean composable dashboard** (you choose the widgets) | **aura-frontend repo** | React 19; new shell, reuse existing components |

**Split:** intelligence → Clarwiz · collateral → pilot · experience → aura-frontend · truth → HubSpot.

**UI decision:** we do **not** reuse aura's screens verbatim. We build a new, cleaner, composable
dashboard where the layout/widgets are configurable, **reusing aura-frontend's proven components**
(deal-insights panel, company tabs, NBA cards, HeyParrot collateral viewer) as building blocks.
New skeleton, harvested organs. Housed in the aura-frontend repo, pointed at Clarwiz + pilot.

### Key decisions
- **Clarwiz is the single backend** spanning ToFu → MOFU. The aura backend's prompts +
  services are ported into Clarwiz (advanced re-implementation), reconstructed from
  `aura-frontend/AURA_SERVICES.md` + frontend call signatures until the real source is provided.
- **Clarwiz is hosted as a pilot tenant.** pilot's HR-specific templates are generalized
  into a GTM/sales collateral directory. No fork of pilot.
- **One stage model:** HubSpot deal stages are canonical. Clarwiz `QUALIFIED` and pilot
  `sales_prospects` stages map onto HubSpot — no competing pipelines.
- **One identity:** every object referenced by HubSpot `dealId` / `companyId` / `contactId`.
- **LLM:** pilot stays on Claude for docs; ported aura intelligence in Clarwiz model TBD on
  seeing source (Clarwiz is OpenAI today).

## 4. Integration seams (the actual work)

1. **HubSpot ↔ Clarwiz** — read deals/companies/contacts; write MQL on `QUALIFIED`; write
   notes/tasks. HubSpot MCP for prototyping; OAuth in Clarwiz for prod.
2. **Clarwiz ↔ new UI** — Clarwiz exposes a clean MOFU API consumed by the new dashboard.
   `aura-frontend/AURA_SERVICES.md` + the existing services are the **reference** for what data
   and prompts exist (not a hard contract, since we control the new UI). New UI points its API
   base at Clarwiz. Reused aura components keep their existing call shapes where convenient.
3. **Clarwiz ↔ pilot** — Clarwiz sends a *collateral-context packet* (deal + company + contact
   ontology + memory + stage) → pilot generates → returns doc (JSON + HTML + PDF + share URL).
4. **pilot internal** — collapse marketing + sales templates into one directory; add a
   MOFU-context generation entrypoint that injects parrot-grade context; reuse
   `edit_document` / `fix_document_styling` / versions / PDF for chat editing & templatizing.

## 5. Phased plan (parallelizable across repos)

- **Phase 0 — Contracts & foundations**
  - Freeze aura API contract as Clarwiz's MOFU spec.
  - Define the collateral-context (ontology) schema + shared HubSpot-ID identity.
  - Stand up HubSpot read in Clarwiz; provision Clarwiz as a pilot tenant.
- **Phase 1 — Clarwiz brain**
  - Port deal/company insights, NBA, signals, web research → Clarwiz, wired to live HubSpot.
  - MQL → HubSpot write on qualification (the ToFu→MOFU bridge).
- **Phase 2 — pilot collateral**
  - Single directory (marketing + sales); MOFU-context generation endpoint.
  - Chat edit + templatizing + versioned share/PDF output.
- **Phase 3 — new dashboard + global chat**
  - Build clean composable dashboard shell (configurable widgets) in aura-frontend repo,
    reusing existing components; point its API base at Clarwiz (intelligence) + pilot (collateral).
  - Company-level view (open leads/deals, intel, NBAs, collateral, contacts); HubSpot-aware global chat.
- **Phase 4 — Both flows end-to-end + demo polish**
  - Flow A: MQL → NBA → collateral → demo scheduled → deal created.
  - Flow B: existing deal → intel → NBA → sales collateral → follow-up/meeting → close.

## 6. Risks / open items
- aura backend source (reconstructing from contract until provided — lossy on exact prompts).
- Three LLM stacks (OpenAI / Claude / unknown) — pick model for ported intelligence.
- HubSpot write scope/permissions for the demo.
- Auth/identity continuity across the three apps.
