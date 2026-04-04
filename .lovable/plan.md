

## Plan: Update ENN Estates — 14 Appts/Session, Hub View Toggle

### What Changes

**1. Change session size from 12 to 14 appointments**
Currently the component uses `12` as the multiplier (12 × 15 min = 3h). ENN uses 14 × 15 min = 3h 30m per session (note: the stated 4h 10m session length includes breaks/admin). All calculations dividing/multiplying by 12 will change to 14. The note at the bottom will update to "1 session = 14 × 15 min appointments".

**2. Add a Practice/Hub view toggle (slider)**
Add a toggle button group alongside the existing Season and Sessions/Appointments toggles. Options: **"By Practice"** (current per-practice cards) and **"By Hub"** (aggregated hub view).

**3. Hub view — 3 hub cards with aggregated data**
When "By Hub" is selected, show 3 large cards instead of 10 practice cards:
- **Harborough Field Surgery** — serves Harborough (13,991), Rushden (9,143), Parklands (13,612), Higham Ferrers (5,569) = 42,315 patients
- **The Cottons** — serves Spinney Brook (11,537), The Cottons (9,372), Marshalls Road (3,156) = 24,065 patients  
- **The Meadows Surgery** — serves Oundle (10,600), Nene Valley (6,921), The Meadows (6,340) = 23,861 patients

Each hub card will show:
- Hub name with HUB badge
- Aggregated list size and % of total
- Total sessions/appointments required (F2F + Remote split)
- List of assigned practices with their individual list sizes underneath

**4. Update the practice breakdown table and summary cards**
- The capacity modelling section and table will also use 14 as the multiplier
- Appts/Session summary card changes from 12 to 14
- Appts/Day changes from 24 to 28

### Technical Details

**File modified:** `src/components/enn/ENNEstatesCapacity.tsx`

- Add hub-practice mapping data structure linking each practice to its hub
- Add `viewLevel` state: `"practice" | "hub"`
- Add toggle UI for Practice/Hub view in the toolbar
- Create hub aggregation logic using `useMemo` that sums list sizes and proportional sessions for each hub's practices
- In hub view, render 3 hub cards + neighbourhood total card, each showing assigned practices as badges/list
- Replace all instances of `12` (appointments per session) with `14`
- Update the note text and summary card values accordingly

