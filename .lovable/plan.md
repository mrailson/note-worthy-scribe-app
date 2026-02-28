

## Add Explainer Banner to Time & Expenses Tab

### What Changes
An informational banner will be added at the top of the **Time & Expenses** tab (below the sub-tab bar, above the summary cards) explaining the purpose and rules of the time reclaim facility.

### Explainer Wording
The banner will include the following text:

> **Pre Go-Live Time Reclaim**
>
> This facility is for reclaiming time spent by Practice Managers, Member Practice GPs, and PCN Support staff involved in preparing the NRES neighbourhood project before go-live. The maximum budget for this programme is **£30,000**. Hours are claimed at agreed rates:
> - **Attending GP** (NRES business): £100 per hour
> - **Practice Manager / PCN Support**: £50 per hour

### Design
- Styled as an `Info`-icon alert box using a light blue/slate background to match the NHS-branded aesthetic already used across the dashboard
- Placed immediately inside the `TabsContent value="time-expenses"` section, before the `TrackerSummary` component (around line 117)
- Uses the existing `Card` component with a subtle info-style border

### Technical Detail

**File: `src/components/nres/hours-tracker/NRESHoursTracker.tsx`**
- Import `Info` icon from `lucide-react`
- Add a styled info card between lines 116-117 (before `TrackerSummary`) containing the explainer text, budget cap, and rate breakdown
- No new components or dependencies required -- this is a simple inline addition

