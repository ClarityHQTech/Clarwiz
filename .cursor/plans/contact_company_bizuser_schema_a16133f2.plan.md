---
name: Contact Company BusinessUser Schema
overview: Restructure Clarwiz into PostgreSQL `core` (Company + BusinessUser) and `clarwiz` (tenant app). Contact is tenant-global (BusinessUser + persona enum). ContactCampaign joins a Contact to a Campaign with status enum and all campaign-specific outreach/qualification state. Signals move to BusinessUserSignal.
todos:
  - id: prisma-schemas
    content: "Update schema.prisma: core/clarwiz schemas, enums (ContactPersona, ContactCampaignStatus), Company, BusinessUser, Contact, ContactCampaign, BusinessUserSignal"
    status: completed
  - id: sql-migration
    content: "Write custom migration: schemas, move public→clarwiz, backfill Company/BusinessUser/Contact/ContactCampaign, rewire FKs, drop Prospect/ProspectSignal"
    status: completed
  - id: resolve-business-user
    content: Add src/lib/resolveBusinessUser.js with upsert logic for Company + BusinessUser + Contact
    status: completed
  - id: api-routes
    content: Update campaign create/add routes; contact-campaign PATCH for status/outreach; move prospects/* → contacts/*
    status: completed
  - id: serialization
    content: Update campaignDetail.js to serialize ContactCampaign rows (flatten businessUser + contact.persona + status)
    status: completed
  - id: execution-layer
    content: Migrate execution/cron/webhooks to contactCampaign+businessUser; qualifyContact updates status enum; BusinessUserSignal
    status: completed
  - id: ui-rename
    content: Campaign table + drawer show ContactCampaignStatus badge; rename prospect UI to contact
    status: completed
  - id: verify
    content: Run migrate, generate, smoke-test create → execute → qualify → drawer status display
    status: completed
isProject: false
---

# Contact / Company / BusinessUser / ContactCampaign schema restructure

## Target data model

**Key change from prior draft:** `Contact` is now **tenant-global** (one per `BusinessUser` per tenant). Campaign membership and all outreach/qualification state live on **`ContactCampaign`**.

```mermaid
erDiagram
  subgraph coreSchema [core schema - shared across tools]
    Company ||--o{ BusinessUser : employs
    BusinessUser ||--o{ BusinessUserSignal : has
  end
  subgraph clarwizSchema [clarwiz schema - Clarwiz app]
    Tenant ||--o{ Contact : owns
    BusinessUser ||--o{ Contact : referenced_by
    Contact ||--o{ ContactCampaign : enrolled_in
    Campaign ||--o{ ContactCampaign : includes
    ContactCampaign ||--o{ CommunicationLog : logs
  end
```

### Enums

**`ContactPersona`** (on `Contact` — tenant's view of the person):

| Value | Meaning |
|-------|---------|
| `DECISION_MAKER` | Final buying authority |
| `INFLUENCER` | Shapes decisions, not final sign-off |
| `CHAMPION` | Internal advocate |
| `GATEKEEPER` | Controls access (EA, procurement coordinator) |
| `ECONOMIC_BUYER` | Budget holder |
| `TECHNICAL_BUYER` | Evaluates technical fit |
| `END_USER` | Day-to-day user |
| `OTHER` | Default / unknown |

**`ContactCampaignStatus`** (on `ContactCampaign` — per-campaign pipeline state):

| Value | Meaning |
|-------|---------|
| `PENDING` | Added to campaign, not yet in active outreach |
| `IN_OUTREACH` | Active sequence running |
| `REPLIED` | Prospect replied, not yet qualified/disqualified |
| `QUALIFIED` | Lead qualified (sets `qualifiedAt`) |
| `NOT_QUALIFIED` | Reviewed, not a fit |
| `DISQUALIFIED` | Negative signal (unsubscribe, wrong person, etc.) |
| `PAUSED` | Outreach paused manually or by rule |

`qualifiedAt` / `qualifiedReason` remain on `ContactCampaign` alongside `status = QUALIFIED` for audit detail.

---

### Field ownership

| Layer | Model | Fields |
|-------|-------|--------|
| Shared (`core`) | **Company** | `name`, `domain?`, `industry?` |
| Shared (`core`) | **BusinessUser** | `companyId?`, `name`, `firstName`, `lastName`, `jobTitle`, `department?`, `seniority?`, `email`, `phone`, `whatsapp`, `linkedinUrl`, `twitterId?`, `location?` — no `tenantId` |
| Shared (`core`) | **BusinessUserSignal** | `businessUserId`, `tenantId?`, `campaignId?`, `type`, `source`, `content` — replaces `ProspectSignal` |
| Tenant app (`clarwiz`) | **Contact** | `tenantId`, `businessUserId`, `persona` (enum, default `OTHER`) |
| Tenant app (`clarwiz`) | **ContactCampaign** | `contactId`, `campaignId`, `status`, `qualifiedAt?`, `qualifiedReason?`, `outreachDeliveryTime?`, `nextScheduledOutreachAt?`, `lastOutreachDate?` |

**`CommunicationLog`** FK changes: `prospectId` → `contactCampaignId` (logs are per-campaign outreach).

**Tenant structure unchanged:** `Tenant`, `Campaign`, integrations, RBAC, etc. gain `@@schema("clarwiz")` only.

---

## Prisma schema (essential models)

Update [`prisma/schema.prisma`](prisma/schema.prisma):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["core", "clarwiz"]
}

enum ContactPersona {
  DECISION_MAKER
  INFLUENCER
  CHAMPION
  GATEKEEPER
  ECONOMIC_BUYER
  TECHNICAL_BUYER
  END_USER
  OTHER
}

enum ContactCampaignStatus {
  PENDING
  IN_OUTREACH
  REPLIED
  QUALIFIED
  NOT_QUALIFIED
  DISQUALIFIED
  PAUSED
}

model Company {
  id            String         @id @default(cuid())
  name          String
  domain        String?
  industry      String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  businessUsers BusinessUser[]
  @@unique([name])
  @@schema("core")
}

model BusinessUser {
  id          String              @id @default(cuid())
  companyId   String?
  company     Company?            @relation(fields: [companyId], references: [id], onDelete: SetNull)
  name        String
  firstName   String?
  lastName    String?
  jobTitle    String?
  department  String?
  seniority   String?
  email       String?
  phone       String?
  whatsapp    String?
  linkedinUrl String?
  twitterId   String?
  location    String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  contacts    Contact[]
  signals     BusinessUserSignal[]
  @@index([email])
  @@index([linkedinUrl])
  @@index([companyId])
  @@schema("core")
}

model BusinessUserSignal {
  id             String       @id @default(cuid())
  businessUserId String
  businessUser   BusinessUser @relation(fields: [businessUserId], references: [id], onDelete: Cascade)
  tenantId       String?
  campaignId     String?
  type           String
  source         String
  content        String
  createdAt      DateTime     @default(now())
  @@index([businessUserId])
  @@index([tenantId])
  @@index([campaignId])
  @@index([businessUserId, campaignId])
  @@schema("core")
}

model Contact {
  id               String            @id @default(cuid())
  tenantId         String
  tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  businessUserId   String
  businessUser     BusinessUser      @relation(fields: [businessUserId], references: [id], onDelete: Restrict)
  persona          ContactPersona    @default(OTHER)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  contactCampaigns ContactCampaign[]
  @@unique([tenantId, businessUserId])
  @@index([tenantId])
  @@index([businessUserId])
  @@schema("clarwiz")
}

model ContactCampaign {
  id                      String                @id @default(cuid())
  contactId               String
  campaignId              String
  status                  ContactCampaignStatus @default(PENDING)
  qualifiedAt             DateTime?
  qualifiedReason         String?
  outreachDeliveryTime    String?
  nextScheduledOutreachAt DateTime?
  lastOutreachDate        DateTime?             @db.Date
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt
  contact                 Contact               @relation(fields: [contactId], references: [id], onDelete: Cascade)
  campaign                Campaign              @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  commLogs                CommunicationLog[]
  @@unique([contactId, campaignId])
  @@index([campaignId])
  @@index([campaignId, nextScheduledOutreachAt])
  @@index([campaignId, status])
  @@schema("clarwiz")
}
```

Update `Campaign.prospects` → `Campaign.contactCampaigns`. Add `Tenant.contacts Contact[]`.

---

## Migration strategy

Single custom migration (`prisma/migrations/20260605120000_core_contact_schema/migration.sql`):

1. Create `core` and `clarwiz` schemas; move all `public` tables → `clarwiz`.
2. Create `core.Company`, `core.BusinessUser`, `core.BusinessUserSignal`.
3. Backfill from `clarwiz.Prospect`:
   - Upsert `Company` from `company` string.
   - Insert `BusinessUser` per row (include `lastName` if parseable from `name`).
   - Upsert `Contact` per `(campaign.tenantId, businessUserId)`; map old `painPoint` heuristics → `ContactPersona` (default `OTHER`).
   - Insert `ContactCampaign` per prospect row with `status = QUALIFIED` where `qualifiedAt` was set, else `PENDING`; carry outreach fields.
4. Migrate `ProspectSignal` → `BusinessUserSignal` (resolve `businessUserId` via old `prospectId` → `ContactCampaign` → `Contact`).
5. Rewire `CommunicationLog.prospectId` → `contactCampaignId`.
6. Drop `Prospect`, `ProspectSignal`.

---

## New shared helper

[`src/lib/resolveBusinessUser.js`](src/lib/resolveBusinessUser.js):

```js
// resolveOrCreateContact(tx, tenantId, { company, name, firstName, lastName, jobTitle, persona, email, ... })
// → { companyId, businessUserId, contactId }

// enrollContactInCampaign(tx, { contactId, campaignId })
// → contactCampaign (status: PENDING, compute nextScheduledOutreachAt)
```

Dedup: **Company** by normalized name; **BusinessUser** by email → linkedinUrl → (companyId + name); **Contact** by `(tenantId, businessUserId)`.

---

## Application layer changes

### API routes

| Current | New |
|---------|-----|
| [`src/app/api/campaigns/route.js`](src/app/api/campaigns/route.js) | Per import row: resolve Contact → `contactCampaign.create` |
| [`src/app/api/campaigns/[id]/prospects/route.js`](src/app/api/campaigns/[id]/prospects/route.js) | `contacts/route.js` — enroll existing or new Contact |
| [`src/app/api/campaigns/[id]/prospects/[prospectId]/route.js`](src/app/api/campaigns/[id]/prospects/[prospectId]/route.js) | `contact-campaigns/[contactCampaignId]/route.js` — PATCH `status`, `outreachDeliveryTime`; DELETE removes enrollment |
| [`src/app/api/admin/tenants/[id]/prospects/route.js`](src/app/api/admin/tenants/[id]/prospects/route.js) | List `contactCampaign` via tenant campaigns, include `contact.businessUser.company` |

### Serialization

[`src/lib/campaignDetail.js`](src/lib/campaignDetail.js) — campaign "prospects" array becomes flattened **ContactCampaign** rows:

```js
{
  id: cc.id,                    // contactCampaignId — used by drawer PATCH/DELETE
  contactId: cc.contactId,
  status: cc.status,
  statusLabel: "Qualified",     // human label for drawer/table
  persona: cc.contact.persona,
  name: cc.contact.businessUser.name,
  firstName: cc.contact.businessUser.firstName,
  lastName: cc.contact.businessUser.lastName,
  company: cc.contact.businessUser.company?.name,
  jobTitle: cc.contact.businessUser.jobTitle,
  email: cc.contact.businessUser.email,
  // ...
  isQualified: cc.status === "QUALIFIED",
  qualifiedAt: cc.qualifiedAt,
  qualifiedReason: cc.qualifiedReason,
  outreachDeliveryTime: cc.outreachDeliveryTime,
  nextScheduledOutreachAt: cc.nextScheduledOutreachAt,
  communications: logsByContactCampaign[cc.id],
}
```

`campaignDetailInclude`:

```js
contactCampaigns: {
  include: {
    contact: { include: { businessUser: { include: { company: true } } } },
  },
  orderBy: { contact: { businessUser: { name: "asc" } } },
}
```

### Qualification flow

Update [`src/lib/execution/qualifyProspect.js`](src/lib/execution/qualifyProspect.js) → `qualifyContact.js`:

- `markContactCampaignQualified(tx, { contactCampaignId, reason })` sets `status = QUALIFIED`, `qualifiedAt`, `qualifiedReason`.
- On negative keyword match → `status = DISQUALIFIED`.
- On reply without qualification → `status = REPLIED`.
- On campaign start / first outreach → `status = IN_OUTREACH`.
- Create `BusinessUserSignal` (not per-contact) on qualification events, with `businessUserId` + `campaignId` + `tenantId`.

### Signals

- Rename [`src/lib/execution/signals.js`](src/lib/execution/signals.js): `serializeProspectSignals` → `serializeBusinessUserSignals`.
- [`src/lib/execution/runCampaignExecution.js`](src/lib/execution/runCampaignExecution.js): load `contactCampaigns` with `contact.businessUser.signals` filtered by `campaignId` for live-signal mode.
- All `prisma.prospectSignal` → `prisma.businessUserSignal`.

### Execution / cron / webhooks (~15 files)

- `prisma.prospect` → `prisma.contactCampaign` with `include: { contact: { include: { businessUser: { include: { company: true } } } } }`.
- Outreach cron queries `contactCampaign` where `nextScheduledOutreachAt <= now()` and `status NOT IN (QUALIFIED, DISQUALIFIED, PAUSED)`.
- Webhook email lookup: find `BusinessUser` by email → `Contact` for tenant → `ContactCampaign` for campaign.
- `CommunicationLog` writes use `contactCampaignId`.

### UI — campaign table + drawer

[`src/app/campaigns/[id]/page.js`](src/app/campaigns/[id]/page.js):

- Table column **Qualified** → **Status** with badge per `ContactCampaignStatus` (color-coded: green `QUALIFIED`, amber `REPLIED`/`IN_OUTREACH`, red `DISQUALIFIED`/`NOT_QUALIFIED`, gray `PENDING`/`PAUSED`).
- Drawer header: show status badge + `qualifiedReason` when qualified.
- Add **Persona** field in drawer (read-only badge from `contact.persona`).
- PATCH `/api/campaigns/${id}/contact-campaigns/${contactCampaignId}` for delivery time override.
- Delete removes `ContactCampaign` row (Contact + BusinessUser remain for reuse).

Status label map (new `src/lib/contactCampaignStatus.js`):

```js
export const CONTACT_CAMPAIGN_STATUS_LABELS = {
  PENDING: "Pending",
  IN_OUTREACH: "In outreach",
  REPLIED: "Replied",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not qualified",
  DISQUALIFIED: "Disqualified",
  PAUSED: "Paused",
};
```

### Import / persona mapping

[`src/lib/parseProspectExcel.js`](src/lib/parseProspectExcel.js):

- Add optional `persona` column aliases (`persona`, `role type`, `buyer type`).
- Map import values to `ContactPersona` enum; default `OTHER`.
- Old `painPoint` / `industry` column no longer maps to persona — stays available for template `{{pain_point}}` via campaign goals or a future `Contact.notes` field (out of scope unless needed).

---

## What stays the same

- Tenant, RBAC, integrations, webhooks, cron auth
- Campaign wizard Excel upload UX
- Template variables (`{{first_name}}`, `{{company}}`, etc.) sourced from `businessUser`
- ICP workbook personas in execution prompts (`TenantIcpContext`) — separate from `Contact.persona` enum

---

## Verification checklist

1. Migration applies on DB with existing prospect data; no orphaned logs
2. Same BusinessUser in two campaigns → one `Contact`, two `ContactCampaign` rows
3. Qualification sets `ContactCampaign.status = QUALIFIED` and shows in table + drawer
4. Reply without qualify sets `REPLIED`; negative reply sets `DISQUALIFIED`
5. Outreach cron respects status exclusions
6. `BusinessUserSignal` created on qualification; execution reads signals by `businessUserId`
7. Admin tenant list shows contact campaigns with status
8. `SELECT * FROM core."BusinessUser"` queryable by other tools

---

## Risks / notes

- **Contact reuse:** deleting a contact from a campaign deletes only `ContactCampaign`; global `BusinessUser` persists in `core`.
- **Status vs qualifiedAt:** keep both — `status` drives UI/filters; `qualifiedAt`/`qualifiedReason` hold audit detail.
- **Cross-schema FKs:** `Contact.businessUserId` → `core.BusinessUser` (RESTRICT); `BusinessUserSignal` lives in `core` so other tools can read signals without clarwiz schema access.
- **Breaking API IDs:** frontend/drawer must use `contactCampaignId` (serialized as `id` in prospects array for minimal UI churn).
