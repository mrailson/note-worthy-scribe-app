

## Updated Plan: Staff Name Anonymisation in Buy-Back Claims

### Requirement
Staff names in buy-back claims must only be visible to:
1. **The practice user who submitted the claim** (the owner)
2. **Authorised approvers** (Malcolm Railson, Dr Mark Gray, Amanda Taylor, Carolyn Abbisogni)

All other NRES users will see anonymised staff names (e.g. "D*** S****" using the existing masking pattern from `patientDataMasking.ts`).

### How It Works

When displaying staff details in buy-back claims:
- The system checks if the current user is the claim submitter (`user_id` matches) or is in the approvers list
- If yes: full staff names are shown
- If no: names are masked using the same `maskPatientName()` utility already used for patient data (first initial + asterisks pattern)

This applies to:
- The Buy-Back Staff List (only your own practice's staff visible in full)
- The Claims History Table (staff snapshots in claims)
- The Admin Claims view (approvers see all names; non-approvers won't access this panel anyway)
- Any exported reports or CSV downloads

### Technical Approach

1. **Reuse existing masking utility** — `src/utils/patientDataMasking.ts` already has `maskPatientName()` which produces output like "D*** S****". We'll use this directly.

2. **Create a helper function** in a new `src/utils/buybackStaffMasking.ts`:

```text
maskStaffName(name, currentUserId, claimOwnerId)
  -> if currentUserId === claimOwnerId -> return full name
  -> if currentUserId is in APPROVERS list -> return full name
  -> else -> return maskPatientName(name)
```

3. **Apply at the component level** — The `BuyBackClaimsTab` component will pass the current user and claim owner IDs to the masking function before rendering staff names. This keeps the raw data in the database unchanged and applies masking purely at display time.

4. **RLS remains unchanged** — Data access is still controlled by RLS (users see own practice data, approvers see all submitted claims). The masking is an additional privacy layer on top of RLS for when users legitimately see other practices' claims in shared reports or summaries.

### Database Impact
None — no schema changes needed for this. Staff names are stored as-is in `staff_details` JSONB. Masking is applied at render time only.

### Files Affected
- **New**: `src/utils/buybackStaffMasking.ts` — staff name masking helper
- **Modified**: `BuyBackClaimsTab.tsx` (and sub-components) — apply masking when rendering staff names in tables and summaries

This will be implemented as part of the main Buy-Back Claims tab build.

