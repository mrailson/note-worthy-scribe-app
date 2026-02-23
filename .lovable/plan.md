

## Practice Detail Pop-Out Modal (Light Theme, NRES Style)

### Overview
Each practice card in the Practice Estate Summary section becomes clickable. Clicking opens a light-themed modal styled consistently with the NRES Results Dashboard (white cards, NHS blue headings, `#F0F4F5` backgrounds).

### Modal Content

**Header:**
- Practice name in large `text-[#003087]` font
- HUB/SPOKE badge (NHS blue for HUB, grey for SPOKE)
- Clinical system badge (SystmOne/EMIS)
- Patient list size and percentage of neighbourhood total

**Financial Summary Card** (light grey `bg-[#F0F4F5]` card):
- Monthly SDA allocation (GBP)
- 9-month budget at 75%
- Annual appointment target

**Seasonal Breakdown** (two side-by-side white cards):
- Non-Winter (39 wks): weekly requirement, F2F count, Remote count, rate per 1,000
- Winter (13 wks): weekly requirement, F2F count, Remote count, rate per 1,000

**Resource Mix Section** (interactive):
- F2F / Remote percentage slider (using existing Slider component)
- Preset buttons: 50/50, 75/25, 100/0
- Live-updating F2F and Remote values based on slider position
- Green-tinted F2F box and indigo-tinted Remote box (matching existing card styling)

### Styling Approach
Matches the NRES `PatientDetailModal` pattern exactly:
- `DialogContent` with `max-w-3xl`, white background, scrollable
- Section headings with NHS blue icon + `text-[#003087]` title
- Cards with `bg-[#F0F4F5]` for key info, white for detail sections
- `Separator` between sections
- NHS colour palette throughout (#005EB8, #003087, #007F3B, #ED8B00)

### Calculation Logic
All values derived dynamically from existing data:
- `totalRequired = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize)`
- `f2fAvailable` from room matrix totals
- `remoteRequired = totalRequired - f2fAvailable`
- Financial: `monthlyBudget = (practice.listSize / totalListSize) * totalBudget`
- Slider adjusts the F2F/Remote split locally (exploratory, not persisted)
- All values respect the current Sessions/Appointments toggle

### Technical Details

**New file:** `src/components/sda/PracticeDetailModal.tsx`
- Receives practice data, capacity config, season, view mode, and split percentage as props
- Local state for the resource mix slider
- Uses existing `Dialog`, `DialogContent`, `DialogHeader`, `Card`, `Slider`, `Badge`, `Separator` components

**Edit:** `src/components/sda/SDAEstatesCapacity.tsx`
- Add `selectedPracticeIndex` state (number | null)
- Add `cursor-pointer` and `hover:shadow-md hover:scale-[1.01]` to each practice card
- Import and render `PracticeDetailModal` at the bottom of the component
- Pass all calculated data (capacity, financials, room matrix totals) as props

No database changes, no new hooks, no new dependencies required.
