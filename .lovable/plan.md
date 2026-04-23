
Fix the PML Finance dashboard so it opens on the Invoices sub-tab by default every time.

1. Update the PML Finance parent dashboard
- In `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`, change the `ClaimsViewSwitcher` default view passed for Finance users from the current non-invoice view to `invoices`.
- Keep Director behaviour unchanged.

2. Make the sub-tab respect parent defaults after mount
- In `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`, update `ClaimsViewSwitcher` so its internal `view` state reacts when the `defaultView` prop changes.
- This prevents stale tab state when moving between Director and Finance views or when the component stays mounted across role/view switches.

3. Preserve the intended Finance workflow
- Ensure Finance still keeps its `invoiced` status filter logic, but now lands on the matching visual tab: `Invoices`.
- Check that the invoice list shown is the same data Finance already uses for payment processing.

4. Prevent regressions
- Verify these cases after implementation:
  - Finance-only user opens PML dashboard -> lands on `Invoices`
  - User switches Director -> Finance -> returns to `Invoices`
  - Director view still defaults to its existing non-finance layout
  - Spreadsheet tab remains available manually, but is no longer the initial Finance tab

Technical details
- Current issue found:
  - `BuyBackPMLDashboard.tsx` currently passes `defaultView={view === 'finance' ? 'cards' : 'spreadsheet'}` to `ClaimsViewSwitcher`
  - `ClaimsViewSwitcher` initialises with `useState(defaultView || 'cards')`, which only applies on first mount
- Required change:
  - Pass `defaultView="invoices"` for Finance
  - Add a `useEffect` in `ClaimsViewSwitcher` to call `setView(defaultView)` when `defaultView` changes and is defined

Files to update
- `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`
- `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`

Acceptance result
- PML Finance no longer opens on Spreadsheet.
- It opens directly on Invoices consistently, including after repeated navigation and role switching.
