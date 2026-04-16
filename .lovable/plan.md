

# Director Query Workflow — Remove Reject, Enhance Query

## Summary

Remove the "Reject" button from the Director's action bar (both PML Dashboard and Admin ClaimCard). Enhance the Query workflow with line-level flagging, prominent visual indicators on the practice dashboard, notification settings in the settings modal, and make queried claims fully inline-editable with resubmit/delete options. Resubmitted claims return to "submitted" status for re-verification.

## Changes

### 1. Remove Reject button from Director views

**`BuyBackPMLDashboard.tsx`** — Remove the "Reject" `ActionBtn` from the Director action bar (line ~656). Update placeholder text to "Notes (required for Query)…". Remove `'reject'` from `handleAction`.

**`BuyBackClaimsTab.tsx`** — In the ClaimCard approver section (~line 2679), remove the Reject button when the user is PML Director (keep it for super_admin). Update help text.

### 2. Add line-level flagging to Query

**`BuyBackPMLDashboard.tsx`** — Add checkboxes next to each staff line in the Director's expanded claim view, allowing the Director to flag specific lines. Pass flagged line indices as part of the query notes (e.g. `{ notes: "...", flagged_lines: [0, 2] }`).

**`useNRESBuyBackClaims.ts`** — Update `queryClaim` to accept an optional `flaggedLines: number[]` parameter. Store in a new `query_flagged_lines` JSONB column on the claims table.

**DB Migration** — Add `query_flagged_lines jsonb default null` column to `nres_buyback_claims`.

### 3. Queried claim visual indicators on practice dashboard

**`BuyBackClaimsTab.tsx` (ClaimCard)** — When `isQueried`:
- Show a prominent red/amber banner at the top: "⚠️ QUERIED BY DIRECTOR — Action Required"
- Display the Director's query notes prominently
- Highlight flagged staff lines with a red left border and "Flagged" badge
- All fields remain inline-editable (already works via `canEdit` logic)
- Show "Resubmit" and "Delete" buttons at the bottom

### 4. Queried claims as key dashboard indicator

**`ClaimsSummaryCards.tsx`** — The "Queried" card already exists for all roles. Enhance it with a pulsing dot or attention icon when count > 0.

**`BuyBackClaimsTab.tsx`** — Auto-sort queried claims to the top of the list. Add a filter pill that highlights when queried claims exist.

### 5. Notification settings in settings modal

**DB Migration** — Add notification toggle columns to `nres_buyback_rate_settings`:
- `notify_submitter_on_query boolean default true`
- `notify_verifier_on_query boolean default true`
- `notify_submitter_on_approve boolean default true`
- `notify_verifier_on_approve boolean default true`
- `notify_submitter_on_resubmit boolean default false`
- `notify_director_on_resubmit boolean default true`

**`useNRESBuyBackRateSettings.ts`** — Add the new fields to `RateSettings` interface and fetch/update logic.

**`BuyBackAccessSettingsModal.tsx`** — Add a "Notification Preferences" panel with individual toggles for each event type.

### 6. Email notifications on query

**`useNRESBuyBackClaims.ts` (`queryClaim`)** — Check notification settings before sending. Send separate emails to:
- Submitter (the person who submitted the claim) — "Your claim has been queried"
- Verifier (if `notify_verifier_on_query` enabled) — "A claim you verified has been queried"

Currently sends `claim_rejected` email type on query — change to a dedicated `claim_queried` template in `buybackEmailService.ts`.

**`buybackEmailService.ts`** — Add `claim_queried` email type with appropriate subject and body including the query notes and flagged lines.

### 7. Resubmit flow

**`useNRESBuyBackClaims.ts`** — Add `resubmitQueriedClaim` function that:
- Sets status back to `submitted`
- Clears `query_notes`, `query_flagged_lines`, `queried_by`, `queried_at`
- Resets `declaration_confirmed` to false (requires re-declaration)
- Sends notification to Director if `notify_director_on_resubmit` enabled

**`BuyBackClaimsTab.tsx`** — Wire resubmit button for queried claims (uses existing submit flow but from queried state).

### Files changed

| File | Action |
|------|--------|
| `BuyBackPMLDashboard.tsx` | Remove Reject btn, add line checkboxes |
| `BuyBackClaimsTab.tsx` | Enhanced queried banner, resubmit/delete, sort queried to top |
| `useNRESBuyBackClaims.ts` | `queryClaim` flagged lines, `resubmitQueriedClaim`, queried email type |
| `useNRESBuyBackRateSettings.ts` | Add notification toggle fields |
| `BuyBackAccessSettingsModal.tsx` | Notification preferences panel |
| `buybackEmailService.ts` | Add `claim_queried` email template |
| `ClaimsSummaryCards.tsx` | Pulsing indicator on Queried card |
| DB migration | `query_flagged_lines` column + 6 notification toggle columns |

