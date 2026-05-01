## Goal

Per PML's request, update the generated invoice PDF so each staff line shows the **Unit Rate** used, and include a **calculation explainer line** beneath the staff table making the math behind the invoice total fully transparent.

## Scope

Single file: `src/utils/invoicePdfGenerator.ts` (used by both download and preview flows via `InvoiceDownloadLink` and `InvoicePreviewDialog`).

No DB changes, no schema changes, no other components touched.

## Changes

### 1. New "Unit Rate" column in the staff line table

Currently the table is:

```text
# | Staff Member | Role | GL Category | Allocation | Amount
```

After:

```text
# | Staff Member | Role | GL Category | Allocation | Unit Rate | Amount
```

Unit Rate derivation per row, mirroring logic already used in `formatMaxClaimableInfo` (`src/utils/buybackMaxClaimable.ts`):

- `gp_locum` + `daily` → `£750 / day`
- `gp_locum` + `sessions` → `£375 / session`
- `meeting` → `£{hourly_rate} / hr`
- `management` + `hours` → `£{hourly_rate} / hr` (× 4.33 wks shown in explainer line)
- Salaried / buy-back / new SDA (`wte`) → `£{calculated_amount} / WTE` (or `On-costs applied` when no per-unit rate exists)
- Fallback → `—`

Column widths re-balanced so the table still fits A4 width (Allocation narrower, Unit Rate ~22mm, Amount right-aligned as today).

### 2. Calculation explainer line beneath the staff table

Immediately under the staff table (before the optional "Details" block / pipe table), render a small italic note:

> *Invoice total derived from: (Allocation × Unit Rate) per line, summed across all staff entries. On-cost multiplier of {X}× applied to salaried/WTE lines where shown.*

The on-cost multiplier value is pulled from `claim.staff_details` (already present per row via `calculated_amount`) — we will surface the multiplier from `useNRESBuyBackRateSettings` indirectly by reading `staff.on_cost_multiplier` if present on the line, otherwise omit the multiplier sentence.

### 3. Per-line formula tooltip text (printed)

Add a thin secondary row beneath each staff line listing the formula string from `formatMaxClaimableInfo(staff).formula`, e.g. `"3 sessions × £375 = £1,125.00"`, rendered in 7.5pt grey under the staff name. Keeps each row to a single visible "card" but makes the math explicit on the printed invoice.

(If this clutters the layout in QA, fall back to a single "Calculation basis" column showing the formula string instead of a sub-row.)

## Verification

- Open an existing claim in the Invoice Preview dialog and confirm:
  - Unit Rate column renders with correct values for locum (sessions + daily), management, meeting, and WTE buy-back rows.
  - Explainer line appears beneath the table.
  - Table still fits on the page; totals box on the right unchanged.
- Download an invoice PDF and confirm the same on the saved file.

## Out of scope

- Changing the invoice number format, GL subtotals, bank details block, or footer.
- Database/schema changes — `unit_rate` is computed from existing `staff_details` fields.
