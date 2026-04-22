

## Make "Close as Withdrawn/Resolved" a Direct Action (No Modal)

### Problem
The "Close as Withdrawn/Resolved" button on the complaint Details page currently opens the full outcome questionnaire modal. The user wants it to directly close the complaint with a simple confirmation — no modal, no form fields.

### Changes

**1. Replace modal trigger with direct close action** (`src/pages/ComplaintDetails.tsx`)
- Replace the button's `onClick={() => setShowQuestionnaireModal(true)}` with a new inline handler that:
  - Shows a browser `confirm()` dialog: "Are you sure you want to close this complaint as Withdrawn/Resolved? This cannot be undone."
  - If confirmed, calls the `create_complaint_outcome` RPC directly with `p_outcome_type: 'withdrawn'` and a default summary
  - Updates the complaint status to `closed` with `closed_at` timestamp
  - Shows a success toast and refreshes the complaint data
- No textarea, no resolution summary field — just confirm and close

**2. Update the card styling to match green "closed" theme** (`src/pages/ComplaintDetails.tsx`)
- Change the card from orange (`border-orange-200 bg-orange-50/50`) to green (`border-green-200 bg-green-50/50`)
- Update text colours from orange to green to match the closed status pills used elsewhere
- Button styled with green border/text to reinforce that this is a closure action

### Files Changed
- `src/pages/ComplaintDetails.tsx` — Direct close logic, green styling

### Behaviour
- Clicking "Close as Withdrawn/Resolved" shows a simple browser confirmation
- On confirm: complaint is closed immediately, status becomes "Closed – Withdrawn/Resolved" (green pill) in all views
- No modal opens, no form to fill in
- The existing green pill display logic for withdrawn outcomes already works (confirmed in ComplaintsSystem.tsx lines 1480-1482)

