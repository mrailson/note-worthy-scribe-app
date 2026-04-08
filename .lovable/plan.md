

## Plan: GP / ANP-ACP Workforce Mix Slider

### What We're Doing
Add a second adjustable slider to each hub card (and the practice/total views) in the Estates & Capacity section that controls the **GP vs ANP/ACP split**. This works alongside the existing On-Site/Remote slider. Both sliders enforce contractual minimums (50% on-site, 50% GP). The UI will dynamically show GP sessions, ANP/ACP sessions, and WTE requirements based on the slider positions.

### Design

Each hub card will have two slider sections below the F2F/Remote boxes:

```text
┌─────────────────────────────────────┐
│  On-Site Split        50% / 50%     │
│  ○────────────────────────────      │
│  50%                        100%    │
│                                     │
│  GP / ANP-ACP Split   50% / 50%    │
│  ○────────────────────────────      │
│  50% GP                  100% GP   │
│                                     │
│  ┌──────────┐  ┌──────────────┐    │
│  │ GP       │  │ ANP/ACP      │    │
│  │ 12.1     │  │ 12.1         │    │
│  │ sessions │  │ sessions     │    │
│  │ 0.9 WTE  │  │ 0.9 WTE      │    │
│  └──────────┘  └──────────────┘    │
└─────────────────────────────────────┘
```

### Key Calculations
- **Sessions** = total on-site sessions × GP% (or ANP%) — already computed from existing on-site slider
- **WTE** = (sessions × 4h10m per session) / 37.5 hours per week
  - 1 session = 4h 10m = 4.167 hours
  - So WTE = sessions × 4.167 / 37.5

### Rules
- GP slider: min 50%, max 100%, step 5%, default 50%
- On-Site slider: min 50%, max 100% (already exists)
- Both remote and ANP/ACP sessions are derived (100% minus slider value)

### Technical Changes

| File | Change |
|------|--------|
| `src/components/enn/ENNEstatesCapacity.tsx` | Add `hubGpPcts` state (same pattern as `hubOnsitePcts`). Add GP/ANP slider + breakdown boxes to hub cards, practice cards, and totals card. Compute GP/ANP sessions and WTE from the on-site sessions × GP%. Add the same to the Workforce Requirements section if desired. |
| `src/components/enn/ENNWorkforceInnovation.tsx` | Update the static 4.9/4.9 WTE cards to be dynamic, driven by the same calculation logic, or leave as-is (separate tab). |

### Scope
- Hub view: each hub gets its own GP/ANP slider (like the existing on-site slider)
- Practice view: uses a global GP/ANP slider (same pattern as the global on-site slider)
- NRES: completely unaffected — this is ENN-only component

