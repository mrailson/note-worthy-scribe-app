## Goal

When a claim is returned by a Verifier or SNO/Director Approver (status = `queried`), the Practice should be able to delete the claim entirely from the Individual Claim View card — with a confirmation pop-up — as an alternative to amending and resubmitting it.

## Where it appears

In the **Individual Claim View** card on the practice's SDA Claims page, inside the existing "⚠ Respond to Query" section (the same row that shows the response input and the green **Resubmit** button), a new red **Delete Claim** button will sit next to Resubmit.

```text
[ Your response to the Verifier query… ]  [ ✅ Resubmit ]  [ 🗑 Delete Claim ]
```

Clicking **Delete Claim** triggers a confirmation pop-up:

> Are you sure you want to delete this claim?
>
> All submission data for this claim will be permanently deleted, including any supporting documents and evidence. This action cannot be undone.
>
> [Cancel] [Delete]

On confirm, the claim and all its evidence are removed (using the existing `deleteClaim` flow that already cleans up `nres_claim_evidence` and storage objects). The claim disappears from the list. A toast confirms deletion.

## Scope

- Only shown when `claim.status === 'queried'` (returned by Verifier or Approver). Not shown for draft, submitted, verified, approved, invoiced, or paid claims.
- Only shown to users who have permission to act on the claim for that practice — the same condition that already gates the Resubmit button.
- No backend changes — `deleteClaim` already exists in `useNRESBuyBackClaims` and is wired into `BuyBackPracticeDashboard` as `onDeleteClaim`.

## Technical changes (single file)

`src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`:

1. **`ClaimsViewSwitcher`** — add optional `onDeleteClaim?: (id: string) => Promise<void>` prop and forward it to `PracticeClaimCard` in the cards view.
2. **`PracticeClaimCard`** — add optional `onDeleteClaim` prop. In the `isQueried` "Respond to Query" block (around line 3445–3472), add a red Delete button beside Resubmit that calls `window.confirm(...)` and then `await onDeleteClaim(claim.id)`. Use a small local `deleting` state to disable both buttons during the call.
3. **Main `BuyBackPracticeDashboard` render** — pass `onDeleteClaim={onDeleteClaim}` to the `<ClaimsViewSwitcher>` at line 3718 (the prop is already destructured at line 3491).

The Verifier and PML dashboards (`BuyBackVerifierDashboard.tsx`, `BuyBackPMLDashboard.tsx`) also use `ClaimsViewSwitcher` but will simply not pass `onDeleteClaim`, so the button will not appear there — preserving the rule that only the practice can delete.

## Out of scope

- No change to the existing per-staff-line Delete button on draft claims (that flow already works).
- No change to the spreadsheet or invoices views — only the cards view shows the queried response area.
- No change to `useNRESBuyBackClaims.deleteClaim` itself.
