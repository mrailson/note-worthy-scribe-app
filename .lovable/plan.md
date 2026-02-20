
## Fix: Update Capacity Planning Figures in the Estates & Capacity Tab

### What's wrong

The **Executive Summary modal** (Practice Capacity Breakdown) is already correct — it has the exact figures from your authoritative table:
- All 7 list sizes match (total 89,584)
- All appointment, financial, and annual target figures match
- Totals row matches (1,361.7 NW / 1,630.4 Winter / 74,301 annual)

The **Estates & Capacity tab** (`SDAEstatesCapacity.tsx`) has a separate `capacityData` object that is out of sync. These are the numbers powering the "Sessions Required by Practice" table, the top banner figures, and the capacity planning panels. They currently show:

| Metric | Current (Wrong) | Correct |
|---|---|---|
| Non-Winter Appts/Week | 1,352 | 1,361.7 |
| Non-Winter Sessions/Week | 112.7 | 113.5 (÷12) |
| Non-Winter F2F Required | 56.35 | 56.75 |
| Non-Winter Remote Required | 56.35 | 56.75 |
| Winter Appts/Week | 1,619 | 1,630.4 |
| Winter Sessions/Week | 134.9 | 135.9 (÷12) |
| Winter F2F Required | 67.45 | 67.95 |
| Winter Remote Required | 67.45 | 67.95 |

### Technical Changes

**One file only:** `src/components/sda/SDAEstatesCapacity.tsx` — `capacityData` object (lines 53–71)

```ts
const capacityData = {
  nonWinter: {
    rate: "15.2 per 1,000",
    weeks: 39,
    apptsPerWeek: 1362,        // was 1352
    sessionsPerWeek: 113.5,    // was 112.7
    sessionLength: "4h 10m",
    f2fRequired: 56.75,        // was 56.35
    remoteRequired: 56.75      // was 56.35
  },
  winter: {
    rate: "18.2 per 1,000",
    weeks: 13,
    apptsPerWeek: 1630,        // was 1619
    sessionsPerWeek: 135.9,    // was 134.9
    sessionLength: "4h 10m",
    f2fRequired: 67.95,        // was 67.45
    remoteRequired: 67.95      // was 67.45
  }
};
```

These values are derived from your authoritative NEIGHBOURHOOD TOTAL row:
- **Non-Winter**: 1,361.7 appts/week → rounded to 1,362; ÷12 appts/session = 113.5 sessions/week; 50% each = 56.75
- **Winter**: 1,630.4 appts/week → rounded to 1,630; ÷12 = 135.9 sessions/week; 50% each = 67.95

### What updates automatically

Because `sortedPracticeSummary` in the Estates tab calculates each practice's session requirement proportionally from `currentCapacity.sessionsPerWeek` and list sizes, the following will all update automatically once `capacityData` is corrected:

- "Sessions Required by Practice" table (all rows)
- The top banner "Sessions/Week" cycling display
- The on-site / remote session split indicators
- The capacity gap analysis panels (if applicable)

No changes needed to `SDAExecutiveSummary.tsx` — it is already correct.
