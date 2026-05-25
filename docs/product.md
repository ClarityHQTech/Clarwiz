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

Stored per tenant.

---

### Enriched Prospect List

Final account book containing:

* Enriched fields with:
    whatsapp number, phone, linkedinUrl, Email

Feeds into campaign engine.

---




# 02. Campaign & Communication Template Setup

**Flow:** Campaign config → stage-channel templates with CTAs

## Campaign

Named campaign example:

* "Summer 2025"

Contains:

* Description
* Target segment
* Start date
* Goals


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

---

## Context Inputs

### Tenant Context

Includes:

* ICP
* Product information
* Brand tone
* Campaign goals

Injected into every execution decision.

---

### Communication Log History

Stores:

* commId
* Timestamp
* Channel
* Message body
* CTA used

Purpose:

* Prevent repetition
* Maintain sequence continuity

---

### Prospect Responses

Tracks:

* Email replies
* Open/no-open status
* LinkedIn accepts/declines
* Website visits
* CTA clicks

Used to inform next action.

---

### Live Signals

Real-time signals:

* LinkedIn posts
* Comments
* Job changes
* Company news

Used for hyper-personalized outreach.

---

## Decision Logic

1. Load all prospect context
2. Score templates by:

   * Relevance
   * Channel fit
   * Campaign stage
3. Detect strong signals
4. Generate custom templates if needed
5. for whatsapp just select from given templates
6. for email select appropriate inbox (prospect db has info of all inboxes and it's usage to avoid spam)
6. Select next-best-action
7. Schedule optimal send time

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

internal signal triggers
If prospect:

* Books demo
* Replies positively

Then:

* Mark as qualified lead
* Notify client
* Stop outreach sequence for that particular prospect

---

# 04. Tracking & Communication Logs

Every touchpoint recorded.

Responses feed back into execution engine.

---

## Communication Log Schema

```json
{
  "commId": "UUID",
  "tenantId": "",
  "prospectId": "",
  "campaignId": "",
  "channel": "email | whatsapp | linkedin | call",
  "templateId": "",
  "stage": "",
  "message": "",
  "sentAt": "",
  "deliveredAt": "",
  "openedAt": "",
  "ctaType": "",
  "ctaClickedAt": "",
  "responseType": "",
  "responseAt": "",
  "responseContent": "",
  "signalRef": ""
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
gets updated in it prospect db

---

## Internal responses recorded in particular comm logs.

Email open/read/reply, linkedin accepted/message_read/reply, Whatapp seen/reply
for this api of smartlead, linkupapi etc and whatsapp provider are used

## Qualified Lead Trigger

Triggered when:

* Demo booked
* Positive intent reply received

Actions:

* Mark qualified lead
* Notify client
* Stop outreach for that prospect

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
* prospectId
* Content snippet
* Timestamp

new signal trigger execution layer, it decides whether to make instant communication or just save and store in context for next comm. 

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
Enriched Prospect
    ↓
Campaign assigns stage templates
    ↓
Execution layer selects next-best-action
    ↓
Communication sent via channel
    ↓
Tracking & response logging
    ↓
Signals update in real time
    ↓
Execution adapts dynamically
    ↓
Qualified lead delivered to client
```
