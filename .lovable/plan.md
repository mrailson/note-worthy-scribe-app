

## Plan: Fix Query Attribution, Layout & Audit Timestamps

### Problems

1. **Wrong "queried by" role**: When the Verifier (Manager) returns a claim to practice, `queryClaim` is called without a `queryRole` (line 937 of `BuyBackClaimsTab.tsx`), so it saves `null` — but dashboards show "Director" via fallback logic. The PML Director path on line 975 always hardcodes `'PML Director'` even when the user is actually NRES Management.
2. **Practice response appears above the original query**: On the Verifier and PML dashboards, the practice response is shown separately and before the query note, making it hard to follow the conversation flow.
3. **No date/time on query or response**: Neither the original query nor the practice response shows when it was raised or answered, which is needed for audit.

### Solution

**File 1: `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`**

- Line 937: Pass `'Verifier'` as `queryRole` when the Verifier dashboard returns to practice: `queryClaim(id, notes, 'Verifier')`
- Line 975: Already passes `'PML Director'` — leave as-is (this is the Director-only view)
- Line 1727: Already uses `isPMLDirector ? 'PML Director' : 'NRES Management'` — correct, leave as-is

**File 2: `src/hooks/useNRESBuyBackClaims.ts`**

- When saving `query_response` during resubmission, also save `query_responded_at: new Date().toISOString()` for audit trail

**File 3: `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`**

- Move the "Practice Response" block to appear directly below the query note (not above it, and not separated by the line items table)
- Restructure as a single audit thread:
  - **Query** block: show `queried_by_role` (not hardcoded "Director"), `queried_by` email, and `queried_at` date/time
  - **Response** block (below): show practice response text with `query_responded_at` timestamp
- Remove the hardcoded `"Director:"` label on line 435 — use `claim.queried_by_role || 'Reviewer'` instead

**File 4: `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`**

- Same restructuring: show query note with `queried_by_role`, `queried_by`, and `queried_at` timestamp
- Show practice response directly below with `query_responded_at` timestamp
- Remove current separate "Practice Response" block that sits above the line items

**File 5: `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`**

- Add `queried_at` date/time to the query display so the practice can see when the query was raised

**Database migration**: Add `query_responded_at` (timestamptz, nullable) column to `nres_buyback_claims` for audit tracking of practice responses.

### Files Modified

- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — pass `'Verifier'` role on return-to-practice
- `src/hooks/useNRESBuyBackClaims.ts` — save `query_responded_at` on resubmission
- `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` — fix role label, reorder query/response, add timestamps
- `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` — fix role label, reorder query/response, add timestamps
- `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` — add query timestamp display
- New migration: add `query_responded_at` column

