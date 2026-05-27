# Execution layer rules

**Canonical source of truth** for ClarWiz campaign execution (`src/lib/execution/`, `src/lib/push/`).

When changing behavior, **update this document first**, then align code. Code references this file via `EXECUTION_RULES_DOC` in `src/lib/execution/executionRules.js`.

Related: [product.md](./product.md) §03 Execution Layer · [campaignConstants.js](../src/lib/campaignConstants.js)

---

## 1. Supported channels (active)

| Channel   | Status   | Push provider        |
|-----------|----------|----------------------|
| `email`   | **Active** | Smartlead (inbox connected) |
| `linkedin`| **Active** | LinkupAPI            |
| `whatsapp`| **Active** | Meta or Interakt     |
| `call`    | **Not built** | — (AI SDR later) |

### Rules

- **Only** `email`, `linkedin`, and `whatsapp` may be planned, logged, pushed, or tracked.
- **Do not** offer `call` to the LLM, include phone in “available channels”, or dispatch call actions—even if the prospect has a phone number.
- Campaign templates use `CAMPAIGN_CHANNELS` in `src/lib/campaignConstants.js` (same three channels).
- Tracking (`trackCampaignEngagement`) only polls email, LinkedIn, and WhatsApp pending logs.

---

## 2. LinkedIn sequence (connection before DM)

LinkedIn has two outbound types, distinguished by `ctaType` on the comm log / template:

| Step | `ctaType`            | Push action                    |
|------|----------------------|--------------------------------|
| 1    | `connect_linkedin`   | Connection request (+ note)    |
| 2    | Any other LinkedIn CTA | Direct message (DM)        |

### Rules

- **Send a LinkedIn DM only after** a connection request for that prospect was **sent** and **accepted**.
- Acceptance is recorded when tracking sets `responseType: "connected"` on the connection-request log (or `deliveryMeta.invitationState === "ACCEPTED"`).
- If the next action is a LinkedIn message but connection is not accepted, **skip** with a clear reason—do not call Linkup `send message`.
- The LLM may still *plan* a connection request (`connect_linkedin`) when not yet connected; it must not plan a DM until history shows acceptance.
- Engagement tracking (`checkLinkedInEngagement`) updates connection accepts and DM replies; replies trigger re-execution (see §8).

---

## 3. Channel eligibility (prospect contact data)

A channel is available only if the prospect has the required field:

| Channel   | Required field      |
|-----------|---------------------|
| `email`   | `prospect.email`    |
| `linkedin`| `prospect.linkedinUrl` |
| `whatsapp`| `prospect.whatsapp` |

- If **no** channel is available → skip: `"No contact channels available for this prospect"`.
- If the model picks a channel the prospect lacks → fall back to the first available channel (never `call`).

---

## 4. Decision engine (LLM next-best-action)

Entry: `decideNextActionForProspect()` in `decideNextAction.js`.

### Inputs

- Tenant context (ICP workbook, value prop, brand tone, campaign goals) via `buildExecutionTenantContext`.
- Campaign templates (per channel + stage, max stage 20).
- Full `communicationHistory` for the prospect.
- Optional **live signals** (LinkedIn posts, job changes, company news, etc.).

### Core behavior

- One **single** next outbound action per execution run per prospect.
- Prefer channels the prospect actually has.
- **Do not repeat** the same `channel` + `stage` already sent unless a **reply** warrants follow-up.
- If the sequence is **exhausted** with no reply → `skip: true`.
- Personalize using prospect + tenant context; avoid generic brochure copy.
- When `tenantContext.icp` is present, align copy with ICP workbook and personas.
- All outbound text must be **send-ready**: no `{{placeholders}}`, `[Your Name]`, or instruction text to the rep.

### Model routing (`modelRouter.js`)

| Tier     | Model (env override)     | When |
|----------|--------------------------|------|
| `simple` | `OPENAI_MODEL_SIMPLE`    | Few logs, no recent reply, no signals |
| `moderate` / `complex` | `OPENAI_MODEL_COMPLEX` | Reply in last 7 days, ≥2 logs, live signals, or ≥4 logs |

Higher temperature on reply follow-ups and signal-driven outreach.

---

## 5. Reply thread mode

When **any** comm log has `responseType` + `responseContent` (prospect replied):

- **Override** template reuse: `templateId` must be `null`; write a direct human reply.
- Reference something specific from `responseContent`.
- Tone: 2–5 short sentences; conversational; match tenant brand tone.
- **Never** paste stage-1 cold templates verbatim.
- Post-process via `finalizeOutboundMessage()` (strip placeholders, generic closings; fallback copy if model output is too thin).

Email and WhatsApp replies detected during tracking also trigger re-execution (§8).

---

## 6. Live signal mode

When the prospect has **live signals** attached:

- Reference the signal naturally (company news → often email; LinkedIn post → often LinkedIn).
- Custom copy encouraged; `templateId` may be `null`.
- `decisionReason` must cite which signal influenced the action.
- Signals do **not** bypass LinkedIn connection-before-DM or WhatsApp template rules.

---

## 7. Channel-specific send rules

### Email

- Requires Smartlead inbox integration: `mode === smartlead_inbox"`, `status === connected"`, account present.
- If not connected → comm log stays `planned`; push returns `skippedSend` (`smartlead_not_connected`).
- Subject required when using email templates.
- Sends via `sendPlannedEmailViaSmartlead` (new lead or thread reply based on history).
- Engagement: Smartlead opens/replies; reply → auto re-run execution for that prospect.

### WhatsApp

- **Must** use an approved campaign template (`templateId` from campaign templates with `channel === whatsapp`).
- **Never** invent template IDs in LLM output.
- If no WhatsApp templates on campaign → skip with reason.
- Variable mapping must match Meta/Interakt template slots (`whatsappVariableMapping`).
- Push requires WhatsApp integration connected (Meta or Interakt).
- Only **template** messages for outbound campaigns (not free-form session messages unless product changes).

### LinkedIn

- Connection: `ctaType === "connect_linkedin"` → `pushLinkedInConnectionRequest`.
- Message: any other CTA → `pushLinkedInMessage` (only if §2 satisfied).
- Requires Linkup integration connected with `linkupAccountId`.
- Requires normalized `linkedinUrl` on prospect.
- **Connection request note length:** LinkedIn enforces a short note on invites (Linkup returns `CUSTOM_MESSAGE_TOO_LONG` when exceeded). ClarWiz caps notes at **200 characters** (safe for free LinkedIn accounts; paid accounts allow up to 300). The LLM is instructed to stay within this limit; `truncateLinkedInConnectionNote()` enforces it at decision time and again in `pushLinkedInConnectionRequest` before calling Linkup.

---

## 8. Tracking and re-execution

Entry: `trackCampaignEngagement()`.

### Pending statuses

`planned`, `queued`, `sent`, `delivered` — with `responseType: null`.

### Per channel

| Channel   | Detects |
|-----------|---------|
| Email     | Smartlead delivery status, opens, replies |
| LinkedIn  | Connection accepted (`list_connections` + `check_invitation`), DM replies (`get_conversation` per prospect) |
| WhatsApp  | Delivered, read, inbound replies (webhooks + polling) |

### LinkedIn credit-saving rules (LinkupAPI)

- **Only track LinkedIn for a prospect if there is prior LinkedIn outreach** in comm logs for that prospect.
  - “Prior outreach” means we have **actually sent** a LinkedIn connection request or message before (e.g., `sentAt` / `deliveredAt` exists, or status is `sent` / `delivered`).
  - If a prospect only has **planned/queued** LinkedIn logs and no previously sent/delivered LinkedIn activity, **do not** call Linkup tracking endpoints (avoid burning credits).
- **Stop tracking specific LinkedIn steps once it’s already resolved in comm logs** (save Linkup credits, without blocking other unresolved steps):
  - If comm logs already show **connection accepted** (`responseType: "connected"` or `deliveryMeta.invitationState === "ACCEPTED"`), do not track connection acceptance again (skip Linkup `check_invitation` / connection-accept polling).
  - If comm logs already show **a new inbound LinkedIn message received** (`responseType: "reply"`), do not poll conversations again for DM replies.

### Re-execution

- On **reply** activity (email or LinkedIn from batch track; WhatsApp via webhook handlers): run `runExecutionForCampaign` for that prospect once (reply thread mode).
- Deduplicate so the same prospect is not re-run twice in one track pass.

---

## 9. Comm log lifecycle

1. **Decision** → create log (`status: planned` or `skipped`).
2. **Push** → update `status`, `deliveryProvider`, `deliveryMeta`; set `deliveredAt` when `sent`.
3. **Track** → update `responseType`, `responseAt`, `responseContent`, opens/delivery meta.
4. **Metrics** → `syncCampaignMetrics` when actions planned or engagement updated.

Skipped decisions still create a log with `status: skipped` and `decisionReason` / skip reason.

---

## 10. Template and variable rules

- Stages: integer `1`–`20` per template.
- Email: subject + body required; body supports `{{first_name}}`, `{{company}}`, `{{job_title}}`, `{{pain_point}}`, `{{prospect_id}}`.
- LinkedIn default CTA on new template: `connect_linkedin`.
- WhatsApp: `whatsappTemplateId` required; body may be preview only; parameters from mapping + prospect/campaign context.
- Valid CTAs: `book_demo`, `reply_email`, `connect_linkedin`, `visit_website` (`CTA_OPTIONS` in campaignConstants).

---

## 11. Integrations must be connected to send

| Channel   | Skip reason (examples) |
|-----------|-------------------------|
| Email     | `smartlead_not_connected` |
| LinkedIn  | `linkedin_not_connected` |
| WhatsApp  | `whatsapp_not_connected` |

Execution **still records** the planned message when integration is missing; UI can show “planned, not sent.”

---

## 12. Explicit non-goals (current)

- **Call / AI SDR** — not implemented; do not schedule or log call channel actions.
- **Optimal send-time scheduling** — not in execution layer yet (product vision only).
- **Qualified lead auto-stop** — product spec; not fully automated in execution (manual / future).
- **UTM / pixel injection** — product spec; verify per-channel push modules.

---

## 13. File map (implementation)

| Concern | Primary files |
|---------|----------------|
| Rules + guards | `src/lib/execution/executionRules.js` |
| LLM decision | `src/lib/execution/decideNextAction.js` |
| Run loop | `src/lib/execution/runCampaignExecution.js` |
| Track + rerun | `src/lib/execution/trackCampaignEngagement.js` |
| LinkedIn gate / engagement | `src/lib/execution/checkLinkedInEngagement.js` |
| Humanize copy | `src/lib/execution/humanizeOutboundMessage.js` |
| Push | `src/lib/push/*.js` |
| API | `src/app/api/campaigns/[id]/execute/route.js`, `.../track/route.js` |

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-05-26 | Initial rules doc; call channel deferred; LinkedIn DM gated on accepted connection |
| 2026-05-26 | Smartlead: import leads with `ignore_duplicate_leads_in_other_campaign: false`; reply thread omits `first_name`; inbox `email_history` for reply bodies |
| 2026-05-27 | LinkedIn track: fix `list_inbox` params (`count`/`cursor`); DM replies via `get_conversation` by prospect profile URL |
| 2026-05-27 | LinkedIn connection note capped at 200 chars (truncate + LLM rule) to avoid Linkup `CUSTOM_MESSAGE_TOO_LONG` |
