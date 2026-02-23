

## Integrate Recruitment Status into Practice Detail Modals

### What This Does
Each practice pop-up modal (e.g. The Parks MC, Brackley MC) will gain a new **"Recruitment Status"** section showing:
- A summary of sessions filled (recruited/offered/buy-back), in pipeline (TBC/potential), and still outstanding
- A colour-coded progress bar (green = filled, amber = pipeline, red = outstanding)
- A detailed breakdown of each staff member/vacancy with their status, session count, and notes
- Grouped by role type (GP, ACP/ANP, Buy-Back)

This mirrors the data from the Workforce Recruitment Tracker but presented in the context of each individual practice.

### How It Will Look
Below the existing "Resource Mix Explorer" section in each modal, a new card will appear with:
1. **Header**: "Recruitment Status" with a Users icon
2. **Summary row**: Three small stat boxes — Filled (green), Pipeline (amber), Outstanding (red) — each showing session count and percentage
3. **Progress bar**: Visual representation of recruitment coverage
4. **Staff detail list**: Each person/vacancy shown with a coloured status badge, session count, role type, and notes

### Technical Approach

1. **Extract recruitment data** from the tracker into a shared data file (`src/data/nresRecruitmentData.ts`) so both the tracker component and the modal can reference the same source of truth.

2. **Create a mapping** from `PracticeKey` (used by the modal) to the recruitment tracker's practice ID:
   - `theParks` -> `parks`
   - `brackley` -> `brackley`
   - `springfield` -> `springfield`
   - `towcester` -> `towcester`
   - `bugbrooke` -> `bugbrooke`
   - `brook` -> `brook`
   - `denton` -> `denton`

3. **Add a new section** to `PracticeDetailModal.tsx` after the Resource Mix Explorer, displaying:
   - Summary stats (filled/pipeline/outstanding counts and percentages)
   - A progress bar matching the tracker's visual style
   - Individual staff rows with status badges, grouped by GP / ACP / Buy-Back

4. **Update the tracker component** to import from the shared data file instead of having inline data, keeping both views in sync.

### Files to Create/Modify
- **Create**: `src/data/nresRecruitmentData.ts` — shared practice recruitment data and helper functions (status config, calculation utilities)
- **Modify**: `src/components/sda/PracticeDetailModal.tsx` — add the Recruitment Status section using data from the shared file
- **Modify**: `src/components/sda/workforce/NRESWorkforceRecruitmentTracker.tsx` — import practice data from the shared file instead of defining it inline

