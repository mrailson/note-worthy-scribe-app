

## Add Total/F2F/Remote Breakdown to Practice Estate Cards

### What Changes

Each practice card in the "Practice Estate Summary" section will be enhanced to show three key figures instead of just the on-site count:

1. **Total Required** -- the number of sessions (or appointments) this practice needs based on its share of the total list size and the selected season
2. **Face-to-Face (On-Site)** -- the available on-site sessions from the Room Availability Matrix (already shown, but now clearly labelled as F2F)
3. **Remote Required** -- the remaining sessions/appointments needed remotely to meet the total (Total minus F2F)

The existing "Remote Sessions" balance card at the end of the grid will remain, showing the neighbourhood-wide remote balance.

### Visual Layout per Card

Each practice card will keep its current styling (blue for HUB, grey for SPOKE) and gain a structured breakdown beneath the practice name:

```text
+---------------------------------------+
| The Parks MC              [HUB]       |
| Roade, Blisworth, ...                 |
|                                       |
| Total Required: 34.6 sessions/week    |
|                                       |
|  F2F (On-Site)    |  Remote           |
|  29               |  5.6              |
|  sessions/week    |  sessions/week    |
|                            [SystmOne] |
+---------------------------------------+
```

- The **Total Required** figure is prominent at the top
- Below it, a two-column mini-layout shows the F2F and Remote split side by side
- F2F comes from the room matrix totals; Remote = Total Required minus F2F
- All values respect the Sessions/Appointments toggle and the season selector
- Clear colour coding: F2F in green tones, Remote in indigo/purple tones

### Calculation Logic

For each practice:
- `totalRequired = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize)`
- `f2fAvailable = practiceColumnTotals[practice.key]` (from room matrix)
- `remoteRequired = Math.max(0, totalRequired - f2fAvailable)`
- When in appointments mode, multiply all values by 12

### Technical Details

**Single file changed:** `src/components/sda/SDAEstatesCapacity.tsx`

Within the practice card rendering block (around lines 680-732):
- Add `totalRequired` calculation using `currentCapacity.sessionsPerWeek` and the practice's list size proportion
- Add `remoteRequired` as `totalRequired - practice.totalSessions`
- Restructure the card body to show the total prominently, then a two-column F2F/Remote split below
- Apply the `multiplier` for appointments mode
- Use consistent colour coding (green for F2F, indigo for Remote) matching the existing Remote Sessions balance card

No database changes, no new files, no new hooks needed -- purely a UI enhancement to the existing practice cards.

