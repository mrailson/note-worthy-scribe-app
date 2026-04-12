

## Plan: PML Director Post-Approval Confirmation View

### Problem
When the PML Director approves a claim, they currently still see the "Mark as Paid" button, which is not their responsibility. Instead, they should see a confirmation panel summarising what happened upon approval.

### What Changes

**1. Hide "Mark as Paid" from PML Director view**
- In `BuyBackClaimsTab.tsx`, pass `isPMLDirector` (or via `rolesConfig`) down to `ClaimCard`
- Update the "Mark as Paid" section (line ~2013) to exclude PML Director — only show for PML Finance and super_admin

**2. Show post-approval confirmation panel for PML Director**
- When a claim is `approved` and the viewer is PML Director, render a new confirmation section replacing the payment processing area
- Content:
  - **Green success banner** with checkmark: "Claim Approved Successfully"
  - **Invoice details**: Invoice number, generated date, total amount, with a download PDF link
  - **Notifications sent**: 
    - "Practice notified: [practice manager name] — invoice attached"
    - "PML Finance notified: [pml_finance email from nres_system_roles]" — list the actual email(s) of users with the `pml_finance` role from the `roles` array already available via `useNRESSystemRoles`
  - Styled as a read-only confirmation card (no action buttons)

**3. Pass additional props to ClaimCard**
- Add `isPMLDirector` boolean prop
- Add `pmlFinanceEmails` string array prop (derived from `roles.filter(r => r.role === 'pml_finance' && r.is_active).map(r => r.user_email)` — already available in the parent component via `useNRESSystemRoles`)

### Files Modified
- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — add props, add confirmation UI, restrict "Mark as Paid" visibility

### Technical Details
- The `useNRESSystemRoles` hook is already called in the parent; extract PML Finance emails from `roles` array
- Invoice download uses existing `supabase.storage.from('nres-claim-evidence').createSignedUrl()` pattern
- The confirmation panel reuses existing invoice/approval metadata already on the claim object (`invoice_number`, `invoice_pdf_path`, `invoice_generated_at`, `approved_by_email`, `reviewed_at`)
- In test mode with `pml_director` role, the confirmation panel will also display correctly

