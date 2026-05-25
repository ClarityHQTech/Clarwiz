# Maildoso API Integration Guide

**Version**: 0.1.0  
**Base URL**: `https://api.maildoso.com` (assumed from context)  
**MCP Server**: `https://mcp.maildoso.com`

**Last Updated**: May 2026

---

## 1. Authentication

All API requests require a **Personal Access Token (PAT)**.

```http
Authorization: Bearer <YOUR_PAT>
```

**How to get PAT**:
1. Login to [app.maildoso.com](https://app.maildoso.com)
2. Go to **Settings → API Keys**
3. Copy token

**Security**:
- Never commit PAT to git
- Rotate regularly
- Store securely (environment variables / secret manager)

---

## 2. User Management

### Get Current User
- `GET /v1/user/me`

### User Registration Data (Required for domains)
- `GET /v1/user/data`
- `POST /v1/user/data`
- `PATCH /v1/user/data`

**Required Fields** (`UserDataRequest`):
- `company_name` (string)
- `job_title` (string)
- `country` (ISO 3166-1 alpha-2, e.g., "US", "IN")

**Other Fields**:
- `first_name`, `last_name`
- `address`, `city`, `state`, `postal_code`
- `phone_zone` (+91, +1, etc.)
- `phone_number`
- `register_email`

### User Stats (Quotas)
- `GET /v1/user/stats`

Returns quotas for:
- `domains`
- `maildoso_accounts`
- `google_accounts`
- `warmups`
- `domains_compensation`

---

## 3. Domains

### Search Domains
**POST** `/v1/user/domains/search`

```json
{
  "domains": ["business", "growth"],
  "add_variations": 5
}
```

### Register New Domains (Maildoso)
**POST** `/v1/user/domains`

```json
{
  "domains": ["mybusiness.com", "growth.io"],
  "redirect_to": ["https://your-saas.com/", null]
}
```

**Restricted TLDs**: `.ca`, `.app`, `.cloud`, `.site`, `.tech`, `.xyz`, `.eu`, `.us`, `.fr`, `.nl`

### Add External Domains (BYO)
**POST** `/v1/user/domains/external`

```json
{
  "domains": ["example.com"],
  "providers": ["maildoso"],
  "redirect_to": ["https://..."]
}
```

**Note**: Must configure NS records within 24h.

### List Domains
**GET** `/v1/user/domains`

**Query Params**:
- `keyword`
- `domain_type`: `STANDARD`, `EXTERNAL`
- `provider`: `maildoso`, `google`
- `created_at` (date range)
- `order_by`

### Domain Statuses
- `ACTIVE`, `AWAITING_NS`, `NS_EXPIRED`, `BLACKLISTED`, `READY`, `FAILED_TO_BUY`, etc.

---

## 4. Email Accounts

### Create Accounts
**POST** `/v1/user/accounts`

```json
[
  {
    "email_account": "john@mybusiness.com",
    "provider": "maildoso",          // "maildoso" or "google"
    "first_name": "John",
    "last_name": "Doe",
    "password": "SuperSecret123!",
    "forwarding_account_id": 123,
    "picture_url": "https://...",
    "is_active": true
  }
]
```

**Password Rules**: Min 12 chars, uppercase, lowercase, digit.

### Lookup Accounts
**GET** `/v1/user/accounts-lookup`

Rich filtering:
- `keyword`, `domains_ids`, `status`, `provider`, `reputations`, etc.

### Update Account
**PUT** `/v1/user/accounts/{account_id}`

Fields: `forwarding_account_id`, `is_premium_warmup`, names, picture, password.

### Delete Accounts
**DELETE** `/v1/user/accounts`

---

## 5. Forwarding Accounts (@maildoso.email)

Central inbox for replies.

### Create Forwarding
**POST** `/v1/user/forwarding`

```json
{
  "email": "team@maildoso.email",
  "first_name": "Team",
  "last_name": "Lead",
  "assignment": "MASTER"
}
```

**Assignment Types**: `MASTER`, `EXTERNAL`, `FRONT_INTEGRATION`, `CLOSE_INTEGRATION`

### Link Sending Accounts to Forwarding
**PUT** `/v1/user/accounts/forwarding`

---

## 6. Warmups

**POST** `/v1/user/services/warmups`

Connect external warmup tools:
- `system_id`: `smartlead`, `instantly`, `allegrow`, `supersend`, etc.
- `warmup_meta.warmup_exclude`: array of tags to block

---

## 7. Sequencers

Connect tools like Instantly, Smartlead, etc.

- `POST /v1/sequencers`
- `POST /v1/sequencers/export`

---

## 8. Key Enums

### Providers
- `maildoso`
- `google`

### Account Status
- `active`, `inactive`, `pending`, `failed`, `cancel_scheduled`

### Reputation
- `high`, `poor`, `burned`, `unmeasured`

### Domain Type
- `STANDARD`, `EXTERNAL`

---

## Recommended Integration Flow for SaaS

1. User provides PAT → Validate with `/user/me`
2. Collect & submit User Data (`/user/data`)
3. Domain Search → Register or Add External
4. Create Forwarding Account
5. Bulk Create Email Accounts (linked to forwarding)
6. Connect Warmup Service
7. (Optional) Export to Sequencer

---

## Tips for SaaS Integration

- Store PAT per customer (encrypted)
- Cache user stats and domain/account lists
- Handle async operations (task_id in responses)
- Monitor domain status (`AWAITING_NS`, `BLACKLISTED`)
- Implement retry logic for domain setup
- Handle Google Workspace specific flows (TOTP, scheduled deletion)

**Error Codes to Handle**:
- 401: Auth required
- 403: Permissions / quota exceeded
- 422: Validation error
- 423: Another operation in progress

---

**This document is optimized for AI coding assistants like Cursor.**  
Use this file as context when building integrations.

**File Name**: `maildoso-api-integration-guide.md`
