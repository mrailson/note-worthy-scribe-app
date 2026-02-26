

## Plan: Buy-Back Email Notifications with Testing Mode Toggle

### Overview
Add a third "Email Settings" tab to the Buy-Back Settings modal with a **Testing Mode** toggle. When enabled, all system-generated emails are redirected to the currently logged-in admin user. When disabled, emails go to their intended recipients. Additionally, define and wire in all email notification types across the claims workflow.

---

### Email Types to Create

| Email Type | Trigger Point | Intended Recipient | Description |
|---|---|---|---|
| **Claim Submitted** | `submitClaim()` | All approvers for that practice | Notifies approvers a new claim awaits review |
| **Submission Confirmation** | `submitClaim()` | The submitting user | Confirms their claim was submitted successfully |
| **Claim Approved** | `approveClaim()` | The submitting user | Notifies the submitter their claim was approved |
| **Approval Confirmation** | `approveClaim()` | The approver (reviewer) | Confirms to the approver that the approval was recorded |
| **Claim Rejected** | `rejectClaim()` | The submitting user | Notifies the submitter their claim was declined, with reviewer notes |
| **Rejection Confirmation** | `rejectClaim()` | The approver (reviewer) | Confirms to the approver that the rejection was recorded |

---

### Technical Implementation

#### 1. Database: Add `email_testing_mode` column to `nres_buyback_rate_settings`

Add a boolean column `email_testing_mode` (default `false`) to the existing settings table. This keeps all Buy-Back settings in one place using the existing singleton row (`id = 'default'`).

```sql
ALTER TABLE nres_buyback_rate_settings
ADD COLUMN email_testing_mode boolean NOT NULL DEFAULT false;
```

#### 2. Hook: Update `useNRESBuyBackRateSettings.ts`

- Add `email_testing_mode` to the `RateSettings` interface
- Read and write the new column alongside existing settings
- Expose a `toggleEmailTestingMode(enabled: boolean)` function

#### 3. Settings UI: Add "Email Settings" tab to `BuyBackAccessSettingsModal.tsx`

- New third tab alongside "Access Permissions" and "Rates & Roles"
- Contains:
  - A **Testing Mode** toggle (Switch component) with clear explanation
  - A summary table of all 6 email types showing: type name, when it triggers, and who receives it
  - A visual indicator showing current mode (e.g. green badge "Live" or amber badge "Testing")

#### 4. New utility: `src/utils/buybackEmailService.ts`

A centralised email service that:
- Accepts the email type, claim data, and the testing mode flag
- Resolves the intended recipient(s) by looking up approver emails for the practice from `nres_buyback_access` joined with `profiles`
- If testing mode is on, overrides all recipients with the current user's email
- Builds styled HTML email content using NHS branding (consistent with existing Resend emails)
- Calls `send-email-resend` edge function
- Returns success/failure

#### 5. Wire emails into `useNRESBuyBackClaims.ts`

Update the three key functions to call the email service after successful DB operations:

- **`submitClaim()`**: Send "Claim Submitted" to approvers + "Submission Confirmation" to submitter
- **`approveClaim()`**: Send "Claim Approved" to submitter + "Approval Confirmation" to reviewer
- **`rejectClaim()`**: Send "Claim Rejected" to submitter + "Rejection Confirmation" to reviewer

The hook will accept the testing mode flag and current user email as parameters (passed from the parent component which already has access to settings).

#### 6. Approver email resolution

Query `nres_buyback_access` for users with `access_role = 'approver'` for the claim's `practice_key`, then join with `profiles` to get their email addresses. This ensures the correct approvers are notified per practice.

---

### Email Template Design

All emails will follow the existing Notewell AI branded template style (`noreply@bluepcn.co.uk`):
- NHS blue gradient header
- Clear subject lines, e.g. "Buy-Back Claim Submitted - [Practice] - [Month]"
- Claim summary: practice, month, total amount, number of staff lines
- Action-specific content (approval notes, rejection reasons)
- Footer with timestamp

---

### Files to Create/Modify

| File | Action |
|---|---|
| `nres_buyback_rate_settings` table | Add `email_testing_mode` column |
| `src/hooks/useNRESBuyBackRateSettings.ts` | Read/write new column, expose toggle |
| `src/components/nres/hours-tracker/BuyBackAccessSettingsModal.tsx` | Add "Email Settings" tab |
| `src/utils/buybackEmailService.ts` | **New** - centralised email dispatch |
| `src/hooks/useNRESBuyBackClaims.ts` | Wire email calls into submit/approve/reject |

