# HubSpot Single Send — real email delivery for NBA emails

By default, "Send via HubSpot" on an NBA **logs** the email on the deal/contact
timeline (a CRM record) but does **not** deliver it. To actually deliver the
email, configure a HubSpot **Single Send (transactional) email** and paste its
email ID into Clarwiz settings.

> Requires the **Transactional Email** add-on / scope on the HubSpot portal.
> Without it, the Single Send API returns `403` and Clarwiz transparently falls
> back to timeline-logging.

## 1. Create the transactional email in HubSpot

1. In HubSpot go to **Marketing → Email** and create a new email.
2. In the email editor, open the **Settings** and turn on **"Save for Single
   Send API"** (this marks the email as transactional/programmable).
3. Build the layout with two custom-property tokens:
   - **Subject line** → `{{ custom.subject }}`
   - **Body** → add a rich-text / HTML module whose content is `{{ custom.body }}`
4. **Publish / save** the email.

## 2. Define the two custom properties

The tokens above are backed by Single Send `customProperties`. Clarwiz sends:

| Token                 | Type           | Comes from                         |
| --------------------- | -------------- | ---------------------------------- |
| `{{ custom.subject }}` | text / string  | the NBA email's subject line       |
| `{{ custom.body }}`    | rich-text / HTML | the NBA email's HTML body          |

No extra setup is needed in HubSpot beyond referencing these two tokens — they
are passed per-send in the API call, not pre-created CRM properties.

## 3. Find the email ID

Open the saved transactional email; the **email ID** is the integer in the
editor URL (e.g. `.../email/<emailId>/...`), or shown in the email's details /
Single Send API panel. It is a plain integer like `12345678`.

## 4. Paste it into Clarwiz

1. In Clarwiz go to **AE Assist → Settings**.
2. In the **Email sending** card, paste the integer into **"Single Send email
   ID"** and click **Save**.
3. The card badge flips to **Delivers**. From now on, "Send via HubSpot"
   delivers the email through Single Send (one send per selected recipient with
   an email address) **and** still logs it on the timeline.

Clearing the field reverts to **timeline-only** logging.

## Behavior summary

- **ID configured + transactional scope present** → real delivery + timeline log
  (`delivered: true`, with `sent` / `failed` counts).
- **No ID configured** → timeline log only
  (`delivered: false, reason: "single_send_not_configured"`).
- **403 on every recipient** (missing transactional scope/add-on) → the send
  returns `{ ok: false, reason: "write_scope" }` so the UI can prompt to fix the
  scope.
