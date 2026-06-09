# ClarWiz — GTM Engine Architecture
Intelligent outreach campaign engine for B2B.

## Goal
Provide qualified leads to clients

## input
Client ICP, Enriched Prospect List

## Channels
1. Email 
2. Linkedin
3. Whatsapp
4. Call/AI SDR

## Tech stack
Frontend/backened - Nextjs
Db - Postgress
Host - Vercel
  
Cold outreach setup
Email - Maildoso + Smartlead  (for min 10 mailboxes for each client, else use smartlead)
Linkedin - LinkupAPI
Whatsapp - Official meta + Most Third party app integration like interackt, AI Sensy etc.
AI Calling - 

---

# Data Model

Canonical schema: `prisma/schema.prisma`. The graph splits into a **shared identity layer** (global across tenants) and a **tenant-scoped GTM layer** (TOFU outreach + MOFU deal intelligence).

## Entity hierarchy

```txt
Company (global)
└── BusinessUser (global person profile)
    └── Contact (tenant-scoped)
        └── ContactCampaign (contact × campaign enrollment)
            └── CommunicationLog

Tenant
├── Contact → BusinessUser → Company
├── Campaign → ContactCampaign
├── Account → Company          (MOFU: HubSpot company mirror)
│   └── Deal                   (MOFU: HubSpot deal mirror)
│       └── DealContact → Contact
└── TenantIcpContext, integrations, …
```

---

## Company

Global company record. Shared across tenants; deduplicated by domain.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `name` | String | Company name |
| `domain` | String? | Unique when set |
| `industry` | String? | |
| `createdAt` / `updatedAt` | DateTime | |

**Relations:** `businessUsers[]`, `accounts[]` (tenant-scoped HubSpot mirrors)

---

## BusinessUser

Global person profile — the enriched prospect identity. One BusinessUser can appear as a `Contact` in multiple tenants (different clients targeting the same person).

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `companyId` | String? | FK → Company |
| `name` | String | Display name |
| `firstName` / `lastName` | String? | |
| `jobTitle` / `department` / `seniority` | String? | |
| `email` | String? | Indexed |
| `phone` / `whatsapp` | String? | Outreach channels |
| `linkedinUrl` | String? | Indexed |
| `twitterId` / `location` | String? | |
| `createdAt` / `updatedAt` | DateTime | |

**Relations:** `company`, `contacts[]` (per-tenant), `signals[]` (TOFU `BusinessUserSignal`)

**Related:** `BusinessUserSignal` — external signals (LinkedIn posts, job changes, etc.) keyed by `businessUserId`, optionally scoped to `tenantId` / `campaignId`.

---

## Tenant

Client workspace. Root of all tenant-scoped data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `name` | String | Client / org name |
| `company_details` | Json? | Onboarding metadata |
| `payment_status` | Boolean | Default `false` |
| `createdAt` / `updatedAt` | DateTime | |

**Relations:**

| Relation | Purpose |
|----------|---------|
| `memberships` / `invitations` | User access (`TenantRole`: ADMIN, MEMBER) |
| `campaigns` | Outreach campaigns |
| `contacts` | Tenant-scoped people (→ BusinessUser) |
| `commLogs` | Communication history |
| `tenantIcpContext` | ICP workbook + GTM Core outputs |
| `linkedInIntegration`, `emailIntegration`, `whatsappIntegration`, `calendlyIntegration` | Channel connectors |
| `mofuIntegration` | HubSpot + MOFU LLM config |
| `accounts` / `deals` | MOFU CRM mirror graph |
| `dealInsights` / `companyInsights` / `nbas` / `signals` | Computed MOFU intelligence |
| `collateralIndex` / `documents` / `assistActionLogs` | AE Assist artifacts |
| `apiKeys` / `integrationWebhooks` | External API + webhook ingress |

---

## Contact

Tenant-scoped view of a person. Links a `Tenant` to a global `BusinessUser`. This is the unit the execution layer operates on for TOFU outreach (formerly referred to as "prospect" in workflow docs).

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `tenantId` | String | FK → Tenant |
| `businessUserId` | String | FK → BusinessUser |
| `persona` | ContactPersona | Default `OTHER` |
| `hubspotContactId` | String? | HubSpot sync |
| `lifecycleStage` | String? | |
| `ownerId` | String? | HubSpot `hubspot_owner_id` — "my book" filtering |
| `createdAt` / `updatedAt` | DateTime | |

**Uniques:** `(tenantId, businessUserId)`, `(tenantId, hubspotContactId)`

**Enum `ContactPersona`:** `DECISION_MAKER`, `INFLUENCER`, `CHAMPION`, `GATEKEEPER`, `ECONOMIC_BUYER`, `TECHNICAL_BUYER`, `END_USER`, `OTHER`

**Relations:** `contactCampaigns[]`, `dealContacts[]` (MOFU stakeholders), `nbas[]`

---

## ContactCampaign

Enrollment of a `Contact` in a `Campaign` — the outreach state machine for one person in one campaign.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `contactId` | String | FK → Contact |
| `campaignId` | String | FK → Campaign |
| `status` | ContactCampaignStatus | Default `PENDING` |
| `qualifiedAt` / `qualifiedReason` | DateTime? / String? | Set when marked qualified |
| `outreachDeliveryTime` | String? | Preferred send time (HH:mm) |
| `nextScheduledOutreachAt` | DateTime? | Next execution slot |
| `lastOutreachDate` | Date? | Last touch date |
| `whatsapp24hWindowExpiresAt` | DateTime? | WhatsApp session window |
| `createdAt` / `updatedAt` | DateTime | |

**Unique:** `(contactId, campaignId)`

**Enum `ContactCampaignStatus`:**

| Status | Meaning |
|--------|---------|
| `PENDING` | Enrolled, not yet in active outreach |
| `IN_OUTREACH` | Sequence running |
| `REPLIED` | Prospect responded |
| `QUALIFIED` | Demo booked / positive intent — stop sequence |
| `NOT_QUALIFIED` | Evaluated, not a fit |
| `DISQUALIFIED` | Removed from sequence |
| `PAUSED` | Temporarily halted |

**Relations:** `contact`, `campaign`, `commLogs[]`

---

## Deal (MOFU)

Tenant-scoped mirror of a HubSpot deal. Anchor for deal intelligence, NBAs, and MOFU signals. SOR remains HubSpot; Clarwiz stores computed intelligence locally.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `tenantId` | String | FK → Tenant |
| `accountId` | String? | FK → Account (HubSpot company mirror) |
| `hubspotDealId` | String | HubSpot deal ID |
| `name` | String | Deal name |
| `stageLabel` | String? | Pipeline stage label |
| `stageBand` | DealStageBand? | `LEAD`, `DEAL_EARLY`, `DEAL_LATE` |
| `amount` | Float? | |
| `status` | DealStatus | `OPEN` (default), `WON`, `LOST` |
| `ownerId` | String? | HubSpot owner |
| `score` | Int? | Computed deal score |
| `lastActivityAt` | DateTime? | |
| `payload` | Json? | Raw HubSpot snapshot |
| `syncedAt` | DateTime | Last sync time |
| `createdAt` / `updatedAt` | DateTime | |

**Unique:** `(tenantId, hubspotDealId)`

**Relations:** `account`, `insights[]` (DealInsight), `nbas[]`, `signals[]`, `dealContacts[]` (→ Contact stakeholders)

**Bridge models:**

- **Account** — tenant ↔ Company bridge with `hubspotCompanyId`, `ownerId`, `lifecycleStage`, `payload`
- **DealContact** — many-to-many Deal ↔ Contact with optional `role`

---

## Campaign (reference)

Named outreach program owned by a tenant. ContactCampaign links contacts into campaigns.

| Field | Type | Notes |
|-------|------|-------|
| `name` / `description` / `targetSegment` / `goals` | String? | Campaign config |
| `startDate` | DateTime? | |
| `status` | String | Default `draft` |
| `sentCount`, `openRate`, `replyRate`, `qualifiedLeads` | Int / Float | Aggregates |
| `calendlyBookingUrl` | String? | Demo booking |
| `smartleadCampaignId` | Int? | Smartlead sync |
| `outreachTimezone` | String | Default `UTC` |
| `defaultOutreachTime` | String | Default `11:00` |
| `enabledChannels` | String[] | Default `["email", "linkedin", "whatsapp"]` |

**Relations:** `contactCampaigns[]`, `templates[]`, `commLogs[]`

---

# WorkFlow and Details:

# 01. Client Intake & Account Enrichment

**Flow:** Tenant onboarding → ICP definition → enriched prospect book

## Components

### ICP Profile

Client provides:

* Industry
* Company size
* Role titles
* Geography
* Pain points
* Tone preferences
* Product context

Stored per tenant in `TenantIcpContext` (linked 1:1 to `Tenant`).

---

### Enriched Prospect List

Final account book containing enriched people, stored as:

* **`BusinessUser`** — global identity (email, phone, whatsapp, linkedinUrl, job title, company)
* **`Company`** — global company record (name, domain, industry)
* **`Contact`** — tenant-scoped enrollment linking the tenant to each BusinessUser

Feeds into campaign engine via **`ContactCampaign`** enrollment.




# 02. Campaign & Communication Template Setup

**Flow:** Campaign config → stage-channel templates with CTAs

## Campaign

Named campaign example:

* "Summer 2025"

Maps to the `Campaign` model. Contains:

* Description, target segment, start date, goals
* Enabled channels (`email`, `linkedin`, `whatsapp`)
* Outreach timezone and default send time
* Calendly booking URL, Smartlead campaign ID

Contacts are enrolled via **`ContactCampaign`** (one row per contact × campaign).

## Communication Templates

Per stage and channel message templates with variables:

```txt
{{first_name}}
{{company}}
{{pain_point}}
```

initial first set of templates will be created for a campaign for each channel
for Whatsapp all follow-up and reply templates will be made 
For Email Mailboxes(s) are setup

## CTA Configuration

Each template defines CTA:

* Book demo
* Reply to email
* Connect on LinkedIn
* Visit website

Tracked using:

* UTM parameters
* Tracking pixel

---



# 03. Execution Layer

**Goal:** Context-aware next-best-action engine

Picks or generates communication templates dynamically.

> **Implementation rules (canonical):** [execution-layer-rules.md](./execution-layer-rules.md) — update that doc first when changing execution behavior; code references it via `src/lib/execution/executionRules.js`.

---

## Context Inputs

### Tenant Context

Includes (from `Tenant` + `TenantIcpContext`):

* ICP workbook, gap analysis, market research, value proposition
* Product information and brand tone
* Campaign goals

Injected into every execution decision.

---

### Communication Log History

Stored in `CommunicationLog`, keyed to `ContactCampaign`:

* commId (`id`)
* Timestamp (`sentAt`, `deliveredAt`, `openedAt`)
* Channel, message body, CTA used
* Template and stage

Purpose:

* Prevent repetition
* Maintain sequence continuity

---

### Prospect Responses

Tracks per `ContactCampaign`:

* Email replies
* Open/no-open status
* LinkedIn accepts/declines
* Website visits
* CTA clicks

Used to inform next action and update `ContactCampaignStatus` (e.g. `REPLIED`, `QUALIFIED`).

---

### Live Signals

Real-time signals on `BusinessUser` (via `BusinessUserSignal`) and MOFU entities (via `Signal` on deals/accounts):

* LinkedIn posts
* Comments
* Job changes
* Company news

Used for hyper-personalized outreach.

---

## Decision Logic

1. Load all context for the `Contact` (via `BusinessUser` + `Company`) and its `ContactCampaign`
2. Score templates by:

   * Relevance
   * Channel fit
   * Campaign stage
3. Detect strong signals
4. Generate custom templates if needed
5. for whatsapp just select from given templates
6. for email select appropriate inbox (prospect db has info of all inboxes and it's usage to avoid spam)
7. Select next-best-action
8. Schedule optimal send time (updates `ContactCampaign.nextScheduledOutreachAt`)

---

## Output

### Communication Dispatch

Sends message via:

* Email
* WhatsApp
* LinkedIn
* AI call

---

### Communication Log Entry

Stores execution details in DB.

---

### Tracking Hooks

Embeds:

* UTM parameters
* Tracking tokens
* Pixel URLs

---

### Qualified Lead Flag

Internal signal triggers when a `ContactCampaign` reaches `QUALIFIED` status.

If prospect:

* Books demo
* Replies positively

Then:

* Set `ContactCampaign.status = QUALIFIED`, record `qualifiedAt` / `qualifiedReason`
* Notify client
* Stop outreach sequence for that contact in that campaign

---

# 04. Tracking & Communication Logs

Every touchpoint recorded.

Responses feed back into execution engine.

---

## Communication Log Schema

Maps to the `CommunicationLog` model. Each log belongs to a `ContactCampaign` (not directly to Contact or Campaign).

```json
{
  "id": "cuid",
  "tenantId": "",
  "campaignId": "",
  "contactCampaignId": "",
  "channel": "email | whatsapp | linkedin | call",
  "templateId": "",
  "stage": 1,
  "subject": "",
  "message": "",
  "ctaType": "",
  "status": "planned | sent | delivered | …",
  "sentAt": "",
  "deliveredAt": "",
  "openedAt": "",
  "ctaClickedAt": "",
  "responseType": "",
  "responseAt": "",
  "responseContent": "",
  "signalRef": "",
  "decisionReason": "",
  "modelUsed": "",
  "providerUsage": {},
  "providerCost": {},
  "deliveryProvider": "",
  "deliveryMeta": {},
  "scheduledFor": "",
  "retryCount": 0,
  "lastRetryAt": "",
  "nextRetryAt": ""
}
```

---

## Token / Cost Tracking

Model used per comm log
Tokens used per comm log (separate for LinkupAPI)
Cost per comm log

---

## Pixel / UTM Tracking

Website URLs include:

* UTM source
* Prospect-specific token

When prospect visits:

* Tracking pixel fires
* Event logged as `website_visit`

Creates passive intent tracking.
Gets updated on the `Contact` / `ContactCampaign` record.

---

## Internal responses recorded in particular comm logs.

Email open/read/reply, linkedin accepted/message_read/reply, Whatapp seen/reply
for this api of smartlead, linkupapi etc and whatsapp provider are used

## Qualified Lead Trigger

Triggered when:

* Demo booked
* Positive intent reply received

Actions:

* Set `ContactCampaign.status = QUALIFIED`
* Notify client
* Stop outreach for that contact in that campaign

---

# External Signals Layer

Feeds execution engine in real time.

---

## Signal Sources

* LinkedIn posts
* LinkedIn comments
* Job changes
* Company news
* Funding events
..

---

## Signal Processing

Each signal contains:

* Type
* Source
* `businessUserId` (TOFU) or `dealId` / `accountId` (MOFU)
* Content snippet
* Timestamp

New signal triggers execution layer — decides whether to make instant communication or save in context for next comm.

Creates a closed feedback loop.

---

# 05. Analytics & Dashboards

Real-time visibility for:

* Clients
* Agency admins

---

## Client View

### Metrics

* Open rate
* Reply rate
* Click rate
* Connection rate
* Qualified leads count
* Cost per lead
* Campaign funnel performance
* Top-performing templates
* Best-performing channels

### Dashboards

* Campaign performance
* Channel breakdown
* Prospect journey
* Qualified leads

---

## Admin View

### Metrics

* Active campaigns
* Total qualified leads delivered
* Sequence completion rates
* Failed deliveries
* Signal volume
* Agent performance
* SLA tracking

### Dashboards

* All clients overview
* Tenant health
* Execution logs
* Lead delivery

---

# 06. Platform Management

Supports two operating modes.

---

## Self-Managed (Client Panel)

Client capabilities:

* Upload account books
* Define/edit ICP
* Create campaigns
* Build templates
* View analytics
* Approve AI-generated templates

---

## Service-Managed (Admin Panel)

Agency/admin capabilities:

* Manage all tenants
* Configure campaigns
* Monitor execution quality
* Curate templates
* Deliver qualified lead reports
* SLA & billing management

---

# Data Flow Summary

```txt
Enriched BusinessUser + Company
    ↓
Contact created (tenant-scoped)
    ↓
ContactCampaign enrolls contact in Campaign
    ↓
Execution layer selects next-best-action
    ↓
Communication sent via channel → CommunicationLog
    ↓
Tracking & response logging → ContactCampaign status updates
    ↓
Signals update in real time (BusinessUserSignal / Signal)
    ↓
Execution adapts dynamically
    ↓
ContactCampaign → QUALIFIED → lead delivered to client
```
