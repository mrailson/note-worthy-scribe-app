I’ll update the SNO Finance/PML Finance claim card so it clearly shows when the SNO Approver approved the claim.

Planned change:

1. Update the Finance claim metadata row
   - In the expanded SNO Finance claim details, show:
     - Approved by: the SNO Approver name/email-derived name
     - Approved at: date and time, e.g. `29/04/2026 at 11:46`
   - This will use the existing approval timestamp already stored on the claim.

2. Fix the current timestamp source
   - The view currently attempts to show `approved_at`, but the claim approval workflow stores the approval timestamp in `reviewed_at`.
   - I’ll update the display to use `reviewed_at`, with a safe fallback if a legacy `approved_at` value exists.

3. Keep British date/time formatting
   - Format will remain day/month/year and hours/minutes only, with no seconds.

Technical details:

- Main file to update: `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`
- No database change is needed because the approval date/time is already stored.
- No email or Edge Function changes are required.