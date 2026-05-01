## Tidy up the claim card header

Right now the collapsed claim card header packs the Claim ID chip, practice name, month, category badges, status badge and (sometimes) the "Over threshold" warning all on one wrapping row, with no labels. On 1366×768 NHS laptops this wraps awkwardly and it's not obvious what each value is.

We'll reorganise into **two clean rows with small captions** above the key fields.

### New layout (collapsed header)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  CLAIM ID     CLAIM PERIOD     PRACTICE                          £1,304 │
│  #100         April 2026       Brackley & Towcester PCN Ltd      1 line │
│                                                                         │
│  [Buy-Back] [NRES Management] [Invoice Issued]                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Row 1 — captioned identification fields** (left side):
  - `CLAIM ID` → `#100` (monospace slate chip)
  - `CLAIM PERIOD` → `April 2026`
  - `PRACTICE` → practice name
  - Captions are 9–10px uppercase muted slate; values are 13px semi-bold.
- **Row 2 — badges**: category chips (Buy-Back / NRES Management / etc.) + status badge + any "Over threshold" warning. Same coloured pills as today, but on their own line so they don't clash with the names.
- **Right side** unchanged: total amount and "N lines · N sessions".

A small reusable inline `Field` helper renders the caption + value pair so spacing/typography stays consistent.

### Where to apply it

- **PML / SNO Approver dashboard** — `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` (the screenshot you sent)
- **Verifier dashboard** — `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` (same single-row issue)
- **Practice dashboard claim card** — `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` (claim row 3116) — same caption treatment so the three views look consistent
- **Practice claims tab card** — `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` (line 2488) — already fairly compact, but we'll add the captions for consistency

### Notes

- No data changes — purely presentational.
- Captions are visible at all times (not on hover) so accountants/approvers immediately see what each value is.
- Spacing kept compact (6px between rows, 14px between caption groups) to honour the NHS-laptop density rule.
- Right-hand total column and the expand chevron stay exactly where they are.
