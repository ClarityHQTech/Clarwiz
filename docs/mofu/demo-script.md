# MOFU "AE Assist" — 5-Minute Demo Script (UC1 + UC2)

A tight run-through of the middle-of-funnel AE Assist layer: hydrate a real
HubSpot sandbox into Clarwiz, work an open deal end-to-end (insight → NBAs →
draft → write-back), and convert a lead into a deal.

## 0. Seed (once, before the demo)

```bash
node scripts/seed-mofu-demo.js
```

This is idempotent — re-running never duplicates rows. It:

- finds-or-creates the **"MOFU Demo"** tenant (`payment_status = true`),
- stores the HubSpot private-app token (encrypted) as the tenant's
  `MofuIntegration`, and
- runs `syncCrmGraph` to mirror the sandbox: the **Northwind Traders** deal,
  its account/contacts, and any MQL leads.

Optional, to pre-populate AI insights so the deal page is non-empty on first
open (otherwise you compute live in step UC2.2):

```bash
SEED_COMPUTE=1 node scripts/seed-mofu-demo.js
```

With **no** HubSpot token in `.env`, the script instead builds a small synthetic
graph (1 account, 2 contacts incl. 1 MQL lead, 1 open deal, 3 collateral rows)
so the dashboard still has content offline.

> Note the seed prints the **tenant id** and **counts** — keep that terminal
> visible if you want to reference it.

---

## UC2 — Work an open deal (the headline flow)

### 1. Sign in → /assist (sync)

- Sign in and go to **`/assist`** (the AE Assist dashboard).
- Click **Sync** (or it auto-syncs). This pulls open deals + MQL leads from the
  sandbox into Clarwiz. You should see **Northwind Traders** in the deal list.

### 2. Open the Northwind deal → Recompute

- Click into **Northwind Traders** (`/assist/deal/[id]`).
- Click **Recompute**. This runs the AURA intelligence pipeline
  (`POST /api/assist/deal/[id]/recompute`): it assembles the deal context and
  generates **DealInsight** (account score, briefing, GTM paths, early
  warnings), **Signals**, and **NBAs**.

### 3. Review insight + NBAs

- Walk the **insight**: account score, summary briefing, and any early-warning
  signals.
- Review the **Next-Best-Actions** — each NBA carries a rationale and resource
  requirements (e.g. an `email_detail` block for a follow-up).

### 4. Draft an NBA email

- On an NBA with an email action, click **Execute / Draft**
  (`POST /api/assist/deal/[id]/nba/[nbaId]/execute`). The model drafts a concise
  HTML follow-up email (subject + body) from the NBA's `email_detail`, persists
  it on the NBA, and marks it **EXECUTED**. Re-clicking returns the same draft
  idempotently.

### 5. Push tasks / add a note (write-back to HubSpot)

- **Push tasks** — `POST /api/assist/deal/[id]/tasks` creates one HubSpot task
  per GTM path/step.
- **Add note** — `POST /api/assist/deal/[id]/note` drops a note on the HubSpot
  deal.
- Both mirror the action into Clarwiz's activity log.

> **Write-scope caveat:** these write-back calls require HubSpot **write**
> scopes on the private-app token. Without them, the routes do **not** crash —
> tasks returns `{ ok:false, reason:"write_scope" }` (on a 403) and the
> note/promote paths surface a similar warning. The read-only insight flow
> (steps 1–4) works regardless.

---

## UC1 — Lead → Deal

### 6. Open a lead

- Back on **`/assist`**, open an **MQL lead** (`/assist/lead/[id]`). This is a
  marketing-qualified contact synced from the sandbox.

### 7. Promote to Deal

- Click **Promote to Deal** (`POST /api/assist/lead/[id]/promote`). This:
  - creates a HubSpot deal in the **first open pipeline stage**,
  - associates the lead's contact (and company, if known),
  - drops a provenance note, and
  - mirrors a **Deal** row into Clarwiz and logs `DEAL_CREATED`.
- Returns `{ ok:true, dealId }` (the Clarwiz Deal id). Association failures are
  non-fatal — the deal is still created with a warning. Returns **412** if
  HubSpot isn't configured.

You can now open the newly promoted deal and run the UC2 flow on it
(Recompute → NBAs → draft → write-back), closing the loop lead → deal → action.

---

## Caveats to call out live

- **Owners-scope 403:** owner-filtered queries (deals/contacts scoped to a
  specific HubSpot owner) need the `crm.objects.owners.read` scope. If the
  sandbox token lacks it, scope the sync to the whole portal (the seed does this
  — it syncs all open deals, not owner-filtered) rather than per-owner.
- **Write scopes:** all write-back (tasks, notes, promote-to-deal) needs HubSpot
  write scopes. Lacking them degrades gracefully (warning / `write_scope`), it
  never 500s the demo. The read/insight path is unaffected.
- **LLM steps** (Recompute, email draft) need `OPENAI_API_KEY`. The seed's
  optional `SEED_COMPUTE=1` pass and the deal-page Recompute both use it.
