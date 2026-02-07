

## Receive Complaints and Compliments via Email

### Overview

Set up a dedicated email address that your practice can receive complaints and compliments on (e.g. `feedback@yourdomain.com` or `feedback@yourteam.resend.app`). When an email arrives, it will be automatically processed by AI to determine whether it is a complaint or a compliment, extract all relevant details, and create the appropriate record in the system -- ready for your team to review.

### How It Works

The system uses **Resend Inbound Emails**, which is part of the Resend service you already have configured. Resend receives emails sent to your designated address, parses the content and attachments, and sends a webhook (JSON payload) to an edge function in your system. The edge function then uses AI to classify and process the email.

```text
Email arrives at feedback address
         |
         v
  Resend receives and parses email
  (extracts body, subject, sender, attachments)
         |
         v
  Webhook fires to edge function
  "process-inbound-feedback"
         |
         v
  AI classifies: Complaint or Compliment?
         |
    +---------+---------+
    |                   |
    v                   v
 COMPLAINT          COMPLIMENT
    |                   |
    v                   v
 Extract:            Extract:
 - Patient name      - Patient name
 - Incident date     - Date
 - Category          - Category
 - Description       - Description
 - Priority          - Staff mentioned
 - Staff mentioned   - Source = "email"
    |                   |
    v                   v
 Insert into         Insert into
 "complaints"        "compliments"
 table               table
    |                   |
    v                   v
 Auto-generate       Auto-generate
 reference number    reference number
 (trigger)           (trigger)
    |                   |
    +--------+----------+
             |
             v
  Store original email as
  a record for audit trail
             |
             v
  Send confirmation email
  back to the sender
```

### One-Time Setup Required (by you, in Resend dashboard)

Before I build this, you will need to do a small bit of setup in the Resend dashboard:

1. **Go to** [resend.com/receiving](https://resend.com/receiving) and find your inbound email address (every Resend team gets a free `@yourteam.resend.app` address), or set up a custom domain
2. **Create a webhook** at [resend.com/webhooks](https://resend.com/webhooks):
   - Set the endpoint URL to: `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-inbound-feedback`
   - Select the `email.received` event
3. **Note your webhook signing secret** -- I will need to store this as a secret so the system can verify incoming webhooks are genuinely from Resend

### What I Will Build

#### 1. New Edge Function: `process-inbound-feedback`

A public (no JWT required) edge function that:
- Receives the Resend `email.received` webhook payload
- Verifies the webhook signature using the signing secret (security)
- Extracts the email subject, body (plain text and/or HTML), sender address, and any attachment metadata
- Sends the content to Gemini AI to classify it as either a **complaint** or a **compliment**
- For **complaints**: extracts patient name, incident date, category, description, priority, staff mentioned, and inserts into the `complaints` table with `complaint_source` set to `'email'`
- For **compliments**: extracts patient name, date, category, description, staff mentioned, and inserts into the `compliments` table with `source` set to `'email'`
- Stores the original raw email content alongside the record for audit purposes
- Sends a confirmation email back to the sender via the existing `send-email-resend` function, including the assigned reference number

#### 2. New Database Table: `inbound_feedback_emails`

An audit trail table to store every inbound email received:

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| from_email | text | Sender's email address |
| from_name | text | Sender's display name |
| subject | text | Email subject line |
| body_text | text | Plain text body |
| body_html | text | HTML body |
| classification | text | 'complaint' or 'compliment' |
| linked_complaint_id | uuid | FK to complaints (if applicable) |
| linked_compliment_id | uuid | FK to compliments (if applicable) |
| reference_number | text | The generated reference (CMP/CMPL) |
| processing_status | text | 'pending', 'processed', 'failed' |
| processing_error | text | Error message if processing failed |
| resend_email_id | text | Resend's email ID for tracking |
| practice_id | uuid | Practice the email is associated with |
| created_at | timestamptz | When the email was received |

RLS policies will restrict access to authenticated users within the same practice.

#### 3. Update `complaintSourceLabels.ts`

Add `'email'` as a new complaint source option so emails are properly labelled in the UI.

#### 4. New UI: Inbound Email Log

A small "Email Inbox" section within the Complaints & Compliments dashboard showing:
- Recent inbound emails and their classification status
- Whether they were processed as a complaint or compliment
- Link to the created record
- Any processing errors that need attention

### File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/process-inbound-feedback/index.ts` | Create | Webhook handler for Resend inbound emails |
| `supabase/config.toml` | Edit | Add `process-inbound-feedback` with `verify_jwt = false` |
| `src/utils/complaintSourceLabels.ts` | Edit | Add 'email' source option |
| `src/pages/ComplaintsSystem.tsx` | Edit | Add inbound email log section |
| Database migration | Create | `inbound_feedback_emails` table with RLS |

### Secret Required

- **`RESEND_WEBHOOK_SECRET`** -- the webhook signing secret from your Resend dashboard, used to verify that inbound webhooks are genuinely from Resend

### Security Considerations

- The edge function is public (no JWT) since it receives webhooks from Resend, but it verifies the webhook signature cryptographically
- Rate limiting is applied to prevent abuse
- All inbound emails are logged for audit purposes
- The service role key is used for database inserts (since there is no authenticated user context in a webhook)

