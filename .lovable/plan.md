

## Inbound Email Service for Complaints and Compliments

### Overview
Create a new edge function that acts as a webhook endpoint for Resend's inbound email feature. When someone sends an email to a designated address (e.g. `complaints@bluepcn.co.uk`), the system will automatically:
1. Receive and parse the email via Resend's webhook
2. Use AI to classify it as a complaint or compliment
3. Extract structured data (patient name, category, description, etc.)
4. Create the appropriate record in the `complaints` or `compliments` table
5. Store the original email for audit purposes
6. Log the processing result

### How It Works

```text
Email sent to complaints@bluepcn.co.uk (or .resend.app address)
    |
    v
Resend parses the email and sends JSON webhook to edge function
    |
    v
Edge function: process-inbound-email
    |
    v
AI classification: Is this a complaint or a compliment?
    |
    +--- Complaint ---> Extract structured data ---> Insert into complaints table
    |
    +--- Compliment --> Extract structured data ---> Insert into compliments table
    |
    v
Store raw email in inbound_emails log table
    |
    v
Return 200 to Resend webhook
```

### Pre-requisites (User Setup in Resend Dashboard)
Before this will work, you will need to:
1. Go to the Resend dashboard at https://resend.com/receiving
2. Either use the auto-generated `.resend.app` address or configure a custom domain (e.g. `complaints@bluepcn.co.uk`)
3. Create a webhook pointing to the edge function URL:
   `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-inbound-email`
4. Select the `email.received` event type

No new secrets are required -- the existing `RESEND_API_KEY`, `OPENAI_API_KEY`, and Supabase service role key are already configured.

### Changes

#### 1. New Database Table: `inbound_emails`
A log table to store every inbound email for audit and debugging.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Auto-generated |
| email_id | text | Resend's email ID |
| from_email | text | Sender address |
| from_name | text | Sender name |
| to_email | text | Recipient address |
| subject | text | Email subject line |
| text_body | text | Plain text content |
| html_body | text | HTML content |
| has_attachments | boolean | Whether attachments were included |
| attachment_count | integer | Number of attachments |
| classification | text | 'complaint', 'compliment', or 'unknown' |
| record_id | uuid | ID of the created complaint/compliment record |
| record_type | text | 'complaint' or 'compliment' |
| processing_status | text | 'pending', 'processed', 'failed', 'manual_review' |
| processing_notes | text | AI processing notes or error details |
| practice_id | uuid | Linked practice (nullable) |
| created_at | timestamptz | When received |

RLS: Enabled with policy for authenticated users to SELECT only (service role inserts via edge function).

#### 2. New Edge Function: `process-inbound-email`
A public (no JWT) webhook endpoint that:

- **Validates** the incoming Resend webhook payload (checks for `type: "email.received"`)
- **Extracts** the email content (from, subject, text body, HTML body, attachments metadata)
- **Classifies** using OpenAI whether the email is a complaint or compliment based on content, tone, and subject line
- **Extracts structured data** using the same AI prompt patterns already used in `import-complaint-data` for complaints
- For compliments, extracts: patient name, email, title, description, category, staff mentioned, source (set to 'email')
- **Creates the record** in the appropriate table using the Supabase service role client
- **Logs** the inbound email to the `inbound_emails` table with processing status
- **Handles attachments**: If attachments are present, notes their count but does not download them at this stage (can be enhanced later via Resend's Attachments API)
- **Falls back** to 'manual_review' status if the AI cannot confidently classify the email

**Complaint fields populated automatically:**
- `patient_name` -- extracted from email content or sender name
- `patient_contact_email` -- from sender address
- `complaint_title` -- extracted/summarised from subject + body
- `complaint_description` -- AI-summarised professionally (same rules as import-complaint-data)
- `category` -- AI-classified using the existing category hierarchy
- `priority` -- AI-inferred from severity
- `incident_date` -- extracted or defaults to today
- `status` -- set to 'submitted'
- `complaint_source` -- set to 'patient' (or 'other' if from an organisation)
- `consent_given` -- defaults to false
- `created_by` -- uses a system/service account approach

**Compliment fields populated automatically:**
- `patient_name` -- extracted or sender name
- `patient_contact_email` -- sender address
- `compliment_title` -- extracted from subject
- `compliment_description` -- email body summarised
- `category` -- AI-classified
- `source` -- set to 'email'
- `compliment_date` -- today's date
- `reference_number` -- auto-generated by existing trigger (CMPL prefix)

#### 3. Frontend: Inbound Email Log Viewer
Add a new sub-tab or section within the Complaints system to view inbound emails and their processing status. This allows practice managers to:
- See all emails received
- View classification results
- Re-process or manually assign emails that failed classification
- Link to the created complaint/compliment record

This will be a simple table view within the existing Complaints & Compliments page.

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| Migration SQL | Create | New `inbound_emails` table with RLS |
| `supabase/functions/process-inbound-email/index.ts` | Create | Webhook endpoint for Resend inbound emails |
| `supabase/config.toml` | Edit | Add `process-inbound-email` with `verify_jwt = false` (webhook) |
| `src/pages/ComplaintsSystem.tsx` | Edit | Add Inbound Emails log viewer tab |

### Technical Details

**Edge Function Authentication:**
The webhook endpoint must be public (`verify_jwt = false`) since Resend sends webhooks without auth headers. The function validates the payload structure to ensure it matches Resend's `email.received` format.

**AI Classification Prompt:**
The AI will receive the email subject and body and classify based on:
- Positive language, praise, thanks = compliment
- Negative language, dissatisfaction, issues, formal complaints = complaint
- Ambiguous = marked for manual review

**`created_by` for auto-created records:**
Since complaints require a `created_by` (NOT NULL, uuid), the edge function will look up a system admin user or the first user linked to the practice. If no user can be determined, the email will be logged with `manual_review` status for a human to process.

**Complaint Source:**
Emails will have `complaint_source` set to `'patient'` by default. The AI will attempt to detect if the sender is an organisation (e.g. NHS Resolution, ICB, solicitor) and set the source accordingly.

**Rate Limiting:**
Resend webhooks are trusted, but the function includes basic validation to reject malformed payloads.

