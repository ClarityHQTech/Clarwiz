# Clarwiz External API Reference (v1)

## Base URL

- Production: `https://your-domain.com/api/external/v1`
- Local: `http://localhost:3000/api/external/v1`

## Authentication

All external data endpoints require an API key.

Use this header:

```http
Authorization: Bearer cw_key_xxxxxxxxxxxxxxxxx
```

### API Key Lifecycle (Admin APIs)

These are internal admin endpoints used to issue/revoke external keys:

- `POST /api/admin/tenants/{tenantId}/api-keys`
- `GET /api/admin/tenants/{tenantId}/api-keys`
- `DELETE /api/admin/tenants/{tenantId}/api-keys/{keyId}`

#### Create API key example

Request:

```bash
curl -X POST "http://localhost:3000/api/admin/tenants/clx_tenant_123/api-keys" \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<admin-session-cookie>" \
  -d '{
    "name": "Partner Sandbox Key",
    "scopes": ["read:all"],
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

Response (`201`):

```json
{
  "apiKey": "cw_key_4a24f2b5b6424bd4a8f9a9f455d83f...",
  "meta": {
    "id": "clx_key_001",
    "tenantId": "clx_tenant_123",
    "name": "Partner Sandbox Key",
    "prefix": "cw_key_4a24f2",
    "scopes": ["read:all"],
    "lastUsedAt": null,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "revokedAt": null,
    "createdAt": "2026-05-28T13:06:20.000Z",
    "createdBy": "clx_user_admin"
  },
  "warning": "Store this key securely. It will not be shown again."
}
```

## Standard Response Format

Success (object):

```json
{
  "data": {},
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

Success (list):

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 57,
    "hasNext": true
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

Error:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Campaign not found."
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

## Error Codes

- `UNAUTHORIZED` - missing/invalid/expired API key
- `FORBIDDEN` - API key does not belong to the requested tenant
- `NOT_FOUND` - resource does not exist
- `VALIDATION_ERROR` - invalid path/query/body fields
- `RATE_LIMITED` - too many requests (reserved for rate limiter)
- `INTERNAL_ERROR` - unexpected server error

## Endpoints

### 1) Health

**GET** `/health`

Purpose: Basic liveness check.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/health"
```

Response (`200`):

```json
{
  "data": {
    "status": "ok",
    "service": "clarwiz-external-api",
    "version": "v1",
    "timestamp": "2026-05-28T13:12:22.399Z"
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 2) List Tenants (API key scoped)

**GET** `/tenants?page=1&limit=20`

Purpose: Return tenant(s) available to the API key. Current behavior returns the key's tenant only.

Headers:
- `Authorization: Bearer <api_key>`

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants?page=1&limit=20" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": [
    {
      "id": "clx_tenant_123",
      "name": "Acme Corp",
      "paymentStatus": true,
      "memberCount": 6,
      "campaignCount": 14,
      "createdAt": "2026-05-20T09:14:00.000Z",
      "updatedAt": "2026-05-28T07:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "hasNext": false
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 3) Tenant Details (includes member info + stats)

**GET** `/tenants/{tenantId}`

Purpose: Return one tenant with member list and top-level counts.

Path params:
- `tenantId` (string, required)

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": {
    "id": "clx_tenant_123",
    "name": "Acme Corp",
    "paymentStatus": true,
    "createdAt": "2026-05-20T09:14:00.000Z",
    "updatedAt": "2026-05-28T07:00:00.000Z",
    "members": [
      {
        "id": "clx_membership_1",
        "userId": "clx_user_1",
        "email": "owner@acme.com",
        "name": "Owner",
        "role": "ADMIN",
        "scopes": [],
        "joinedAt": "2026-05-20T09:20:00.000Z"
      }
    ],
    "stats": {
      "campaigns": 14,
      "prospects": 862
    }
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 4) List Tenant Members

**GET** `/tenants/{tenantId}/members?page=1&limit=20`

Purpose: Paginated members for a tenant.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123/members?page=1&limit=20" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": [
    {
      "id": "clx_membership_1",
      "userId": "clx_user_1",
      "email": "owner@acme.com",
      "name": "Owner",
      "image": null,
      "role": "ADMIN",
      "scopes": [],
      "joinedAt": "2026-05-20T09:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "hasNext": false
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 5) List Campaigns for a Tenant

**GET** `/tenants/{tenantId}/campaigns?page=1&limit=20`

Purpose: Paginated campaign list with high-level performance fields.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123/campaigns?page=1&limit=20" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": [
    {
      "id": "clx_campaign_101",
      "tenantId": "clx_tenant_123",
      "name": "Q2 Mid-Market Outbound",
      "description": "Lead gen campaign",
      "targetSegment": "B2B SaaS",
      "goals": "Meetings",
      "status": "active",
      "startDate": "2026-05-22T10:00:00.000Z",
      "sentCount": 1240,
      "openRate": 31.5,
      "replyRate": 7.8,
      "qualifiedLeads": 52,
      "prospectCount": 300,
      "createdAt": "2026-05-21T13:00:00.000Z",
      "updatedAt": "2026-05-28T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 14,
    "hasNext": false
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 6) Tenant Campaign Metrics (aggregate)

**GET** `/tenants/{tenantId}/campaigns/metrics`

Purpose: Aggregate metrics across all campaigns of one tenant.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123/campaigns/metrics" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": {
    "tenantId": "clx_tenant_123",
    "totalCampaigns": 14,
    "totalProspects": 2100,
    "totalSent": 8650,
    "totalQualifiedLeads": 265,
    "avgOpenRate": 29.45,
    "avgReplyRate": 6.9
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 7) Campaign Details

**GET** `/tenants/{tenantId}/campaigns/{campaignId}`

Purpose: Return one campaign with setup/performance/count details.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123/campaigns/clx_campaign_101" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": {
    "id": "clx_campaign_101",
    "tenantId": "clx_tenant_123",
    "name": "Q2 Mid-Market Outbound",
    "description": "Lead gen campaign",
    "targetSegment": "B2B SaaS",
    "goals": "Meetings",
    "status": "active",
    "startDate": "2026-05-22T10:00:00.000Z",
    "sentCount": 1240,
    "openRate": 31.5,
    "replyRate": 7.8,
    "qualifiedLeads": 52,
    "calendlyBookingUrl": "https://calendly.com/acme/demo",
    "counts": {
      "prospects": 300,
      "templates": 9,
      "communicationLogs": 1450
    },
    "createdAt": "2026-05-21T13:00:00.000Z",
    "updatedAt": "2026-05-28T08:00:00.000Z"
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

### 8) Campaign Metrics (single campaign)

**GET** `/tenants/{tenantId}/campaigns/{campaignId}/metrics`

Purpose: Metrics focused on one campaign.

Example:

```bash
curl -X GET "http://localhost:3000/api/external/v1/tenants/clx_tenant_123/campaigns/clx_campaign_101/metrics" \
  -H "Authorization: Bearer cw_key_..."
```

Response (`200`):

```json
{
  "data": {
    "campaignId": "clx_campaign_101",
    "tenantId": "clx_tenant_123",
    "metrics": {
      "prospects": 300,
      "communicationLogs": 1450,
      "prospectSignals": 62,
      "sentCount": 1240,
      "openRate": 31.5,
      "replyRate": 7.8,
      "qualifiedLeads": 52
    },
    "generatedAt": "2026-05-28T13:25:00.000Z"
  },
  "requestId": "f8e9b3ce-7ce3-44f8-a95d-123456789abc"
}
```

## Reserved For Later (Execution Context Inputs)

This path is reserved and intentionally not implemented yet:

- `POST /api/external/v1/tenants/{tenantId}/campaigns/{campaignId}/prospects/{prospectId}/signals`

Planned request body (draft):

```json
{
  "type": "manual_note",
  "source": "crm",
  "content": "Prospect requested budgetary proposal in Q3."
}
```

## Quick Start (cURL)

```bash
API_KEY="cw_key_..."
TENANT_ID="clx_tenant_123"
CAMPAIGN_ID="clx_campaign_101"

curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/external/v1/tenants/$TENANT_ID"

curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/external/v1/tenants/$TENANT_ID/campaigns?page=1&limit=20"

curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/external/v1/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/metrics"
```
