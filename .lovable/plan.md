
# Combined Staff & Claims Tab: Buy-Back + New NRES SDA Staff

## Overview

Enhance the existing Buy-Back Claims tab to support **two staff categories** — Buy-Back Staff (existing practice staff bought back for SDA work) and **New NRES SDA Staff** (newly recruited GPs, ACPs/ANPs hired for the programme). Each staff member and claim will be linked to one of the **7 neighbourhood practices**, and admins (like Amanda) can manage claims on behalf of any practice.

---

## What Changes

### 1. Database Changes

Add two new columns to `nres_buyback_staff`:
- `staff_category` (text, default `'buyback'`) — values: `'buyback'` or `'new_sda'`
- `practice_key` (text, nullable) — stores the practice identifier (e.g. `'parks'`, `'brackley'`)

Add one new column to `nres_buyback_claims`:
- `practice_key` (text, nullable) — which practice the claim is for

Update RLS policies so admins (from `NRES_ADMIN_EMAILS` / `BUYBACK_APPROVER_EMAILS`) can read/write staff and claims for any user, enabling Amanda to manage claims on behalf of practices.

### 2. UI Changes to BuyBackClaimsTab

**Staff Management Section:**
- Rename section title from "Buy-Back Staff" to "NRES SDA Staff"
- Add a **Staff Category** toggle/select: "Buy-Back" or "New SDA Recruit"
- Add a **Practice** dropdown (the 7 practices: The Parks MC, Brackley MC, Springfield Surgery, Towcester MC, Bugbrooke Surgery, Brook Health Centre, Denton Village Surgery)
- Staff table gains two new columns: Category (badge) and Practice
- Filter/group staff by practice for clarity

**Claims Section:**
- Add a **Practice** dropdown when creating a claim — determines which practice the claim is for
- Claims history table gains a Practice column
- For admins: show a practice filter and allow creating claims for any practice
- For practice users: default to their own practice

**Guide Section:**
- Update the collapsible guide text to explain both buy-back and new SDA staff categories

### 3. Hook Updates

**`useNRESBuyBackStaff.ts`:**
- Update `BuyBackStaffMember` interface to include `staff_category` and `practice_key`
- Update `addStaff` to accept and save the new fields
- For admins: fetch all staff (not just own `user_id`); for regular users: fetch own only

**`useNRESBuyBackClaims.ts`:**
- Update `BuyBackClaim` interface to include `practice_key`
- Update `createClaim` to accept `practice_key`
- For admins: fetch all claims; for regular users: fetch own only

### 4. Practice Data

Use a shared constant mapping the 7 practices:

```text
parks       -> The Parks MC
brackley    -> Brackley MC
springfield -> Springfield Surgery
towcester   -> Towcester MC
bugbrooke   -> Bugbrooke Surgery
brook       -> Brook Health Centre
denton      -> Denton Village Surgery
```

### 5. Admin vs Practice User Behaviour

| Capability | Practice User | Admin (Amanda etc.) |
|---|---|---|
| Add staff | Own practice only | Any practice |
| View staff | Own entries | All practices |
| Create claim | Own practice | Any practice (on behalf) |
| Submit claim | Own claims | Any claim |
| Approve/reject | No | Yes (existing flow) |

---

## Files to Modify

1. **Database migration** — add `staff_category`, `practice_key` columns; update RLS
2. **`src/hooks/useNRESBuyBackStaff.ts`** — new fields, admin fetch logic
3. **`src/hooks/useNRESBuyBackClaims.ts`** — new fields, admin fetch logic
4. **`src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`** — new dropdowns, table columns, admin controls
5. **`src/utils/buybackStaffMasking.ts`** — update `canViewStaffName` to also check admin emails list
