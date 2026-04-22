

## Plan: Fix Claim Type Labels in Emails and Add Submitted-By Details to All Dashboards

### Problems

1. **Missing submitted-by info**: The PML Dashboard (`BuyBackPMLDashboard.tsx`) and Verifier Dashboard (`BuyBackVerifierDashboard.tsx`) do not display the email address of the person who submitted the claim. Only the Practice view (`BuyBackClaimsTab.tsx`) shows this.

2. **Incorrect claim type in emails**: The `getClaimTypeLabel()` function in `buybackEmailService.ts` only recognises `buyback` and `new_sda` categories. All other types (`management`, `gp_locum`, `meeting`) fall through to a confusing generic label: "NRES SDA Staff and Buy-Back Claim". This produces misleading subjects like "Your NRES SDA Staff and Buy-Back Claim has been verified" for a management-only claim.

3. **Invoice email from_name hardcoded**: The approval email in `useNRESBuyBackClaims.ts` (line 917) always sends with `from_name: 'NRES Buy-Back Claims'` regardless of the actual claim type.

### Solution

**File 1: `src/utils/buybackEmailService.ts`**

Update `getClaimTypeLabel()` to handle all category types correctly:

| Categories present | Label |
|---|---|
| `buyback` only | Buy-Back Claim |
| `new_sda` only | New SDA Claim |
| `management` only | NRES Management Claim |
| `gp_locum` only | GP Locum Claim |
| `meeting` only | Meeting Attendance Claim |
| Multiple categories | SDA Claim (generic, no confusing "Staff and Buy-Back") |
| No categories | SDA Claim |

This fixes subjects, headings, and body text across all 9 email types automatically, since they all call `getClaimTypeLabel()`.

**File 2: `src/hooks/useNRESBuyBackClaims.ts`**

Update the invoice email `from_name` (currently hardcoded as `'NRES Buy-Back Claims'`) to use the dynamically derived `claimTypeLabel` — e.g. `'NRES Management Claims'` or `'NRES GP Locum Claims'`.

**File 3: `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`**

Add `submitted_by_email` to the claim detail panel (near the existing "Submitted" date and "Verified by" fields) so the PML Director can see who raised the claim.

**File 4: `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`**

Add `submitted_by_email` to the claim card detail section so verifiers can see who submitted each claim.

### Files Modified

- `src/utils/buybackEmailService.ts` — expand `getClaimTypeLabel()` to cover all 5 category types
- `src/hooks/useNRESBuyBackClaims.ts` — dynamic `from_name` on invoice email
- `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` — add submitted-by email display
- `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` — add submitted-by email display

