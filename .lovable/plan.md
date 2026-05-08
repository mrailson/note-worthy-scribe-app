## Goal

Let practices record the **actual** cost they incurred for a claim line **only when it exceeds the maximum reclaimable amount**. This gives the PML/finance team visibility of how much practices are paying above the ICB-approved cap, so over-spend can be reported.

## UX

In the `InlineClaimPanel` (the draft/claim editor inside `BuyBackPracticeDashboard.tsx`), add a new compact section directly under "Step 2 — Actual invoice amount to claim":

```text
Step 3 — Actual cost incurred (optional)
Only complete this if your real cost was HIGHER than the maximum reclaimable
(£X,XXX.XX). This is for reporting only — it will not increase your payment.

[ £  __________ ]   Overspend vs max: £YYY.YY
[ Notes (optional): why was the cost higher? ]
```

Behaviour:
- Field is **optional** and hidden behind a small "Record actual cost (over max)" toggle/link to keep the panel tidy.
- If the entered value is **≤ max reclaimable**, show an inline hint: *"Only record a value here if it is above the maximum reclaimable (£X). Leave blank otherwise."* and do not persist a value below max (clear it on save).
- If the value is **> max**, highlight the overspend amount in amber and persist it.
- Visible in both Hours and Sessions modes, and across all staff categories (Buy-Back, New SDA, Management, GP Locum, Meeting).
- Also surfaced (read-only) in the Verifier and PML dashboards as a small "Actual cost: £X (£Y over max)" tag on the claim line so reviewers can see it.

## Data

Add two new nullable columns to `public.nres_buyback_claims`:
- `actual_cost_incurred numeric` — the practice-entered actual spend.
- `actual_cost_notes text` — optional explanation.

(Single value per claim, matching how `claimed_amount` and `practice_notes` are already stored. No migration needed for existing rows; both default to NULL.)

A simple reporting view `public.nres_buyback_overspend_v` will expose claims where `actual_cost_incurred > calculated_amount`, with the delta, so PML can pull a list of practices paying above the cap. SECURITY INVOKER, RLS on the base table governs access.

## Wiring

- Extend the existing `updateClaim` / draft-save path so `actual_cost_incurred` and `actual_cost_notes` are persisted alongside `practice_notes` on Save Draft and Submit.
- Reset the field to NULL automatically if the user lowers it to ≤ max before saving.
- No change to `claimed_amount` logic — payment is still capped at max.

## Files touched

- `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` — new UI section in `InlineClaimPanel`, prop threading for the new save handler, read-only display in verifier/PML lists.
- New migration adding the two columns + reporting view.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

## Out of scope

- A dedicated "Overspend report" page (the view is enough for now; we can build a UI later if you want).
- Changing payment/claim caps — actual cost is informational only.
