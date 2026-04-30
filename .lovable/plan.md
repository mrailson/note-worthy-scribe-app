## Practice Claim — default & changeable claim month

### Behaviour today
- The Staff Roster table shows up to 3 month columns. The column for today's calendar month is highlighted blue and labelled "This month".
- Clicking a "+ Claim" button opens the Inline Claim Panel locked to that column's month. There is no way to change the month from inside the panel.
- Result: from the 1st of a new month, the highlighted "This month" target jumps to the new month even though most practices are still claiming for the month just ended.

### What you want
1. The **default highlighted claim target** should be the **previous month** when today is the 1st–15th of the month, and the **current month** otherwise (16th onward).
2. The user must still be able to **change the claim month** to current (or any allowed month) if they want to.

### Changes (file: `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`)

**1. Add a small helper for the default target month**
```ts
function getDefaultClaimMonthStr(): string {
  const now = new Date();
  const useLast = now.getDate() <= 15;
  const target = useLast
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}
```

**2. Use it instead of `currentMonthStr` for the "default target" highlight**
- Around line 1930, add `const defaultClaimMonthStr = getDefaultClaimMonthStr();`.
- Where the table header decides the blue "This month" highlight (line 2146) and the cell button highlight (line 2171), use `defaultClaimMonthStr` instead of `currentMonthStr` for the **primary** highlight. Keep `lastMonthStr` logic only as a fallback for cases where the default already equals last month (avoid double-highlighting).
- Update the small label under the header from "This month" to "Default claim month" (and drop the redundant "Last month" amber label when it equals the default).

**3. Add a "Change month" control inside the Inline Claim Panel**
- In `InlineClaimPanel` (around line 595, where `fullMonth` is computed and rendered as the big title), render a small dropdown next to the month title:
  - Options = the same `claimMonths` already passed down (≤ 3 recent months, filtered by `PILOT_START`).
  - Default selection = the `monthDate` the panel was opened with.
  - On change: close the current panel and re-open it for the newly chosen month (call `onClickClaim(`${staffMember.id}_${newMonthDate}`)`). This reuses the existing open/close mechanism — no new state plumbing.
- Disable months that are in the future relative to today (matches existing `isFuture` rule in `MonthStatusCell`).

**4. Wire `claimMonths` into the panel**
- Pass the existing `claimMonths` array (already in scope at the table render, line 2175) as a prop to `InlineClaimPanel` so the dropdown has its options.

### What is NOT changing
- `getClaimMonths()` still returns the same 3-month window — no schema changes.
- `MonthStatusCell` "+ Claim" buttons remain on every eligible month, so the user can also change month by clicking a different column directly.
- No database or edge-function changes. Pure UI.
- All existing styling, calculation logic, and submit flow are untouched.

### Net effect
- On 1–15 May 2026, April is highlighted as the default and the panel opens on April. The user can switch to May from the dropdown (or by clicking May's column).
- On 16+ May, May is highlighted as the default. April remains selectable.
