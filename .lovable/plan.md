## Add sequential Claim ID to Buy-Back claims

Currently each claim only has a UUID `id` (a long random string) and an `invoice_number` (which is only generated after approval). There is no short, human-friendly reference to use when communicating about a claim. We will add a sequential `claim_ref` starting at 100.

### 1. Database — add sequential claim_ref column

Migration on `nres_buyback_claims`:
- Add column `claim_ref integer` (unique).
- Create a Postgres sequence `nres_buyback_claims_claim_ref_seq` starting at `100`.
- Set the column default to `nextval('nres_buyback_claims_claim_ref_seq')` so every new claim auto-assigns the next number.
- Backfill existing rows (currently 1 row) — assign 100 to the existing claim ordered by `created_at` ascending.
- Add a unique index on `claim_ref`.

Result: every claim gets `100`, `101`, `102`, … automatically on insert. No app-side generation needed (avoids race conditions).

### 2. Hook / type updates

- `src/hooks/useNRESBuyBackClaims.ts` — add `claim_ref: number | null` to the `BuyBackClaim` interface. No insert change required (DB default handles it). Make sure `select('*')` continues to return it (it will).

### 3. Display the Claim ID on every view

Add a clear, copy-friendly badge "Claim #100" (using British spelling, neutral styling consistent with the existing chips) to:

- **Practice claim card** — `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`
  - Show in the card header next to the practice/month title.
  - Also use the real `claim_ref` (instead of `claim.id.slice(0,8).toUpperCase()`) in the declaration text on line ~2398: change `Claim Reference: …` to `Claim #${claim.claim_ref}`.
  - Show in the Invoice dialog title alongside the invoice number.
- **Verifier dashboard** — `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` — header of each claim card.
- **PML / SNO Approver dashboard** — `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` — header of each claim card, next to the existing invoice link / Preview invoice button.
- **Invoice Preview dialog** — `src/components/nres/hours-tracker/InvoicePreviewDialog.tsx` — show `Claim #100` in the dialog title alongside the invoice number.
- **Generated invoice PDF** — `src/utils/` invoice PDF generator (`generateInvoicePdf`): add a "Claim #100" line in the invoice header so the printed/downloaded invoice also carries it.
- **Evidence email** — `supabase/functions/send-evidence-email/index.ts`: include `Claim #100` in the email subject and header block.
- **Merged print bundle header** — include `Claim #100` in the per-claim banner.

### 4. Styling

Small chip, consistent with existing badges:
```text
[ Claim #100 ]   neutral slate background, monospace number
```
Placed first in the card header so it's the most prominent reference.

### Files touched

- New migration (add column, sequence, default, backfill, unique index)
- `src/hooks/useNRESBuyBackClaims.ts` (type only)
- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`
- `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`
- `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`
- `src/components/nres/hours-tracker/InvoicePreviewDialog.tsx`
- `src/utils/invoicePdfGenerator.ts` (or wherever `generateInvoicePdf` lives)
- `supabase/functions/send-evidence-email/index.ts`

### Notes

- Sequence-based default means no application logic is required to assign numbers — guaranteed unique and gap-tolerant.
- Existing UUID `id` is kept as the internal primary key; `claim_ref` is purely the human reference.
- Format displayed as `Claim #100`. If you'd prefer `CLM-100` or `#NRES-100`, say the word and I'll switch the format in one place.
