## Goal

In the practice view of the Buy-Back dashboard, let practice users configure a list of named contacts (name + email) who should receive practice-bound notifications, with an on/off toggle per contact for each of the three email types:

1. **Invoice copies** (when an invoice is generated/sent for a claim from this practice)
2. **Payment confirmation from PML** (when a claim status moves to `paid`)
3. **SNO Approver approval** (when a claim is approved by the PML/SNO approver)

This sits alongside the existing built-in notifications (submitter / verifier / director). It does not replace them — it adds extra CC recipients scoped to the practice.

## What gets built

### 1. New table: `nres_buyback_practice_email_recipients`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| practice_key | text not null | the NRES practice key |
| contact_name | text not null | display label (e.g. "Anne — Finance") |
| email | text not null | validated, lowercased |
| receive_invoice | boolean default true | toggle 1 |
| receive_payment_confirmation | boolean default true | toggle 2 |
| receive_approval | boolean default true | toggle 3 |
| is_active | boolean default true | soft on/off for the whole row |
| created_by | uuid | auth user id |
| created_at / updated_at | timestamptz | |

- Unique on (practice_key, lower(email)).
- RLS: SELECT/INSERT/UPDATE/DELETE allowed for users who already have practice access through the existing `nres_buyback_access` mechanism (mirrors the policy used by `nres_buyback_staff`), plus full access for super-admins / management leads / PML director / PML finance.

### 2. New hook: `useNRESBuyBackPracticeEmailRecipients(practiceKey)`

Standard CRUD wrapper around the table:
- `recipients` (array)
- `addRecipient({ name, email, flags })`
- `updateRecipient(id, partial)` — used by the toggle switches and inline edit
- `removeRecipient(id)`

Email format validated client-side with a small zod schema (trim, lowercase, max 255).

### 3. Practice dashboard UI — "Notification recipients" panel

Add a collapsible card to `BuyBackPracticeDashboard.tsx`, placed under the existing practice header (above the staff roster sections). Same compact NHS-laptop styling used elsewhere in the file.

Layout (example):

```text
Notification recipients for The Parks Medical Practice           [+ Add contact]
────────────────────────────────────────────────────────────────────────────────
Name              Email                       Invoice  Payment  Approval   ⋮
Anne Smith        anne@parks.nhs.uk             [ON]    [ON]     [OFF]    ✏ 🗑
Finance Inbox     finance@parks.nhs.uk          [ON]    [OFF]    [OFF]    ✏ 🗑
Practice Manager  pm@parks.nhs.uk               [OFF]   [ON]     [ON]     ✏ 🗑
```

- Each toggle is an immediate save (optimistic update + toast on error).
- Add row inline at top of the table with name, email and three pre-checked toggles.
- Empty state: short helper text explaining the three categories and that these contacts will receive *copies* of the relevant notifications.

### 4. Wiring into existing email sends

The practice already has built-in notifications for submitter/verifier on approve/paid. We extend the three relevant call paths to also pull active recipients for the claim's `practice_key` and add them as additional `to:` (or `cc:` — matching what each existing flow does) addresses, filtered by the relevant per-recipient toggle:

| Trigger | Filter | Where the change goes |
|---|---|---|
| Invoice generated/sent for a claim | `is_active AND receive_invoice` | invoice send path in `BuyBackClaimsTab` / `BuyBackPMLDashboard` invoice flow |
| Claim status → `paid` (payment confirmation from PML) | `is_active AND receive_payment_confirmation` | the existing "Payment email" path in `useNRESBuyBackClaims` |
| Claim approved by PML Director (SNO Approver) | `is_active AND receive_approval` | the approval path in `useNRESBuyBackClaims` (the `approve` action) |

The existing email-suppression and email-testing-mode rules continue to apply unchanged — extra recipients are filtered the same way.

### 5. Permissions

- Visible to anyone who can already see that practice's dashboard (existing `nres_buyback_access` grant).
- Read-only display for users without edit access to the practice (e.g. PML viewers) — toggles and add/remove disabled with a tooltip.

## Out of scope

- No bulk import / no CSV upload — single inline form is enough.
- No history/audit of who toggled what (existing audit log isn't currently extended for rate settings either).
- No new email template — uses the existing invoice / payment / approval templates and just adds extra recipients.
- No edit to the existing built-in submitter/verifier/director notification toggles in admin settings.

## Files touched

- New migration creating `nres_buyback_practice_email_recipients` + RLS.
- New `src/hooks/useNRESBuyBackPracticeEmailRecipients.ts`.
- New `src/components/nres/hours-tracker/PracticeEmailRecipientsPanel.tsx`.
- `BuyBackPracticeDashboard.tsx` — mount the new panel under the header.
- The three email-send call sites (invoice / paid / approve) — fetch + merge extra recipients before sending.