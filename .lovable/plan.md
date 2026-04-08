

## Make Insurance Checklist Interactive (ENN Only)

### What We're Doing
Replace the static, hardcoded ENN insurance checklist with a database-backed interactive version where users can click checkboxes to confirm Public Liability and Employers Liability status, enter the insured amount, and see who last updated each practice and when. Remove the "Rebecca Gane Checked" badge. NRES remains untouched (static data).

### Database

**New table: `enn_insurance_checklist`**
- `id` uuid PK
- `practice_name` text NOT NULL
- `insurance_type` text NOT NULL (Public, Employers, Prof/MDU, Clinical/CNSGP)
- `confirmed` boolean DEFAULT false
- `amount` text DEFAULT 'TBC'
- `updated_by` text (user email/name)
- `updated_at` timestamptz DEFAULT now()
- UNIQUE constraint on `(practice_name, insurance_type)`
- RLS: authenticated users can SELECT and UPDATE

Seed with 10 ENN practices × 4 insurance types (40 rows). Public/Employers start as `confirmed=false, amount='TBC'`; Prof/MDU and Clinical/CNSGP start as `confirmed=true, amount='No Limit'`.

### Component Changes

**1. New hook: `src/hooks/useENNInsuranceChecklist.ts`**
- Fetches all rows from `enn_insurance_checklist`
- Groups by practice_name
- Provides `toggleConfirmed(id, confirmed)` and `updateAmount(id, amount)` mutations
- Records `updated_by` (current user email) and `updated_at` on each change

**2. Modify `SDAFinanceGovernance.tsx`**
- Add new prop `interactiveInsurance?: boolean` (only ENN sets this to true)
- When `interactiveInsurance` is true:
  - Remove the "Rebecca Gane Checked" badge
  - Use data from `useENNInsuranceChecklist` instead of `customInsuranceChecklist`
  - Make Public and Employers checkboxes clickable (toggle confirmed status)
  - On click, show a small popover/inline input to set the amount (e.g. £5m, £10m)
  - Employers Liability: stay amber if amount < £5m
  - Show "Updated by [name] · [date]" under each practice card
- When `interactiveInsurance` is false (NRES): behaviour unchanged

**3. Modify `ENNDashboard.tsx`**
- Remove the hardcoded `customInsuranceChecklist` array
- Remove `customInsuranceCheckedBy` and `customInsuranceUpdatedDate` props
- Pass `interactiveInsurance={true}` instead

### Files to Create
| File | Purpose |
|------|---------|
| Migration SQL | `enn_insurance_checklist` table + seed data |
| `src/hooks/useENNInsuranceChecklist.ts` | Data hook for interactive checklist |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/sda/SDAFinanceGovernance.tsx` | Add interactive mode with clickable checkboxes, amount input, last-updated display |
| `src/pages/ENNDashboard.tsx` | Remove hardcoded checklist, pass `interactiveInsurance` prop |

### NRES Safety
NRES never sets `interactiveInsurance`, so the existing static display is completely unaffected.

