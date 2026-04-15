

# Improved KPI Status Cards with Hover Tooltips

## What changes

Replace the current 4 KPI cards (Drafts, In Pipeline, Queried, Paid) in `BuyBackPracticeDashboard.tsx` with 7 status-specific cards that each show count + value, with hover tooltips explaining the workflow stage.

## New cards (in pipeline order)

| Card | Statuses | Colour | Tooltip |
|------|----------|--------|---------|
| **Drafts** | `draft` | #64748b | Claims being prepared, not yet submitted to NRES |
| **Awaiting Verification** | `submitted` | #2563eb | Submitted by practice, awaiting NRES Verification |
| **Awaiting Approval** | `verified` | #7c3aed | Verified by NRES, awaiting PML Finance Director Approval |
| **Approved** | `approved` | #059669 | Approved by PML Finance Director, ready for invoicing |
| **Invoiced** | `invoice_created`, `scheduled` | #d97706 | Invoice created and scheduled for payment |
| **Paid** | `paid` | #16a34a | Payment completed and confirmed |
| **Queried** | `queried` | #dc2626 | Returned with queries — action required from practice |

## Technical approach

1. **Update `KpiCard` component** — add a `tooltip` prop. Wrap each card in a `title` attribute or use the existing `HoverCard` component from `src/components/ui/hover-card.tsx` for a richer hover popover showing the label description and value breakdown.

2. **Expand the `totals` useMemo** — compute per-status values (approved, invoiced, etc.) instead of just the current 4 buckets.

3. **Update the grid** — change from `repeat(4, 1fr)` to `repeat(7, 1fr)` with slightly smaller card padding to fit the 1000px container comfortably on NHS laptops.

4. **All changes confined to `BuyBackPracticeDashboard.tsx`** — the `KpiCard` sub-component, the `counts`/`totals` memos, and the KPI grid section (~lines 205-213 and 2865-2958).

