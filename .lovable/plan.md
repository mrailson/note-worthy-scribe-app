

## Plan: On-Site Provision Slider (50%–100%)

### What Changes

Add a slider control that lets users adjust the on-site (F2F) percentage from 50% to 100%. The remote percentage auto-adjusts as the complement (e.g. 70% on-site = 30% remote). All F2F and Remote figures across practice cards, hub cards, and neighbourhood totals update in real-time.

Additionally, show the corresponding **Sessions Required On-Site** and **Sessions Required Remote** alongside the existing appointments/sessions figures in each card.

### Technical Details

**File:** `src/components/enn/ENNEstatesCapacity.tsx`

1. **Replace hardcoded split with state:**
   - Change `const activeSplit = 50; const remoteSplitPct = 50;` to `const [onsitePct, setOnsitePct] = useState(50);` with `remotePct = 100 - onsitePct`
   - Update all references to `activeSplit` and `remoteSplitPct` to use these reactive values

2. **Add slider UI** below the existing toolbar toggles:
   - Labelled "On-Site Provision" with current percentage displayed (e.g. "70% On-Site / 30% Remote")
   - Uses the existing `Slider` component, min=50, max=100, step=5
   - Styled consistently with the existing toggle pill area

3. **Add sessions breakdown** to each hub/practice card:
   - Below the F2F/Remote appointment boxes, show a small row: "X.X sessions on-site • Y.Y sessions remote"
   - Calculated as: `(f2fAppts / APPTS_PER_SESSION)` and `(remoteAppts / APPTS_PER_SESSION)`

4. **Reactivity:** Add `onsitePct` to the dependency arrays of `capacityData`, `totalCapacity`, `hubAggregatedData`, and `sortedPracticeSummary` useMemo hooks so all figures recalculate when the slider moves.

