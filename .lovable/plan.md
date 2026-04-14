

## Plan: PML Director & PML Finance Claims Visibility and Actions

### Current State

The claims pipeline is: **Draft → Submitted → Verified → Approved → Invoice Created → Scheduled → Paid**

Currently:
- **PML Director** (`approver` role): can only see and approve claims at `verified` status
- **PML Finance** (`finance` role): can see `approved` onwards and process invoice/schedule/paid steps
- Both roles see ALL claims (no status filtering in the UI — only practice role is filtered)

The issue is primarily about **what claims each role sees** and ensuring the workflow matches your description.

### What Will Change

#### 1. PML Director Visibility (in `NRESClaimsOversight.tsx`)
- Filter `visibleClaims` for the `approver` role to show:
  - **Verified** claims (awaiting their approval)
  - **Approved, Invoice Created, Scheduled, Paid** claims (previously approved — full downstream visibility)
- This means they will NOT see drafts or submitted (pre-verification) claims
- They CAN approve verified claims and raise queries on them

#### 2. PML Finance Visibility (in `NRESClaimsOversight.tsx`)
- Filter `visibleClaims` for the `finance` role to show only:
  - **Approved, Invoice Created, Scheduled, Paid** claims
- They will NOT see drafts, submitted, or verified claims
- They handle all three steps: Invoice Created → Scheduled → Paid (already works)

#### 3. Query Ability for PML Director (in `useNRESClaims.ts`)
- Already partially working — the `canQuery` function allows `approver` to query `verified` claims
- No changes needed here

#### 4. Summary Cards Update
- Update `ClaimsSummaryCards` to show relevant counts per role (only counting visible statuses)

### Files to Modify

| File | Change |
|------|--------|
| `src/components/nres/claims/NRESClaimsOversight.tsx` | Add status-based filtering for `approver` and `finance` roles in `visibleClaims` |
| `src/components/nres/claims/ClaimsSummaryCards.tsx` | May need minor adjustments if it shows irrelevant status counts |

### Technical Detail

In `NRESClaimsOversight.tsx`, the `visibleClaims` memo becomes:

```text
practice  → filter by selected practice
approver  → filter to verified, approved, invoice_created, scheduled, paid
finance   → filter to approved, invoice_created, scheduled, paid
super_admin / verifier → show all (no filter)
```

This is a UI-only change — no database migrations needed. The `getAction` and `canQuery` functions already correctly restrict what each role can *do*; this plan only changes what they can *see*.

