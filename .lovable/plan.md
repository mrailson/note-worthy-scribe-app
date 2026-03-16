

## Plan: Apply Name & Term Corrections to Meeting History Cards with "Update This Meeting" Button

### What This Does
Currently, name/term corrections (from `medical_term_corrections` table) are only applied during AI note generation. This plan extends them to:
1. **Display corrected text** on the meeting history card (title + overview) in real-time
2. **Show matched corrections** so users can see what was caught
3. **Add "Update This Meeting" button** — user corrects names, presses the button, and the stored title/overview/notes are updated in the database immediately

### Technical Approach

#### 1. Apply corrections to card display (MeetingHistoryList.tsx)
- Import `medicalTermCorrector` from `@/utils/MedicalTermCorrector`
- Where `meeting.title` is rendered (line ~2235), apply `medicalTermCorrector.applyCorrections(meeting.title)` for display
- Where `meeting.overview` is passed to `MeetingDetailsTabs` (line ~2933), apply corrections to the overview text
- Same treatment in `MeetingGridView.tsx` for the grid card title and overview

#### 2. Show matched corrections on the card
- Create a small helper function that compares original vs corrected text and extracts which corrections were applied
- Display matched corrections as small badges below the title (e.g., "Corrected: Jhon → John, Smth → Smith")
- Only show when corrections were actually applied (non-empty diff)

#### 3. "Update This Meeting" button
- Add a button (visible when corrections exist for that meeting) in the action buttons area of each meeting card
- On click, apply `medicalTermCorrector.applyCorrections()` to:
  - `meetings.title` — update via Supabase
  - `meeting_overviews` table — update the overview text
  - `meeting_summaries.summary` — update the summary/notes
  - `meeting_summaries.key_points` array — apply to each item
- Update local state immediately for instant UI feedback
- Show a toast confirming what was updated

#### 4. Enhance CorrectionManager with meeting context
- When opened from a specific meeting's card, pass the meeting ID so the user can see which corrections apply to that meeting
- After corrections are edited and user presses "Update This Meeting", apply and persist

### Files to Modify
- **`src/components/MeetingHistoryList.tsx`** — Import corrector, apply to displayed title/overview, add correction badges, add "Update This Meeting" button with handler
- **`src/components/meeting-history/MeetingGridView.tsx`** — Apply corrections to displayed title/overview in grid view
- **`src/components/CorrectionManager.tsx`** — Optional: accept `meetingId` prop to show meeting-specific context
- **`src/utils/MedicalTermCorrector.ts`** — Add `getAppliedCorrections(text)` helper that returns which corrections matched

### Implementation Detail

The "Update This Meeting" handler will:
```
1. Load corrections from medicalTermCorrector
2. Apply to title → update meetings table
3. Apply to overview → update meeting_overviews table  
4. Apply to summary, key_points, action_items, decisions → update meeting_summaries table
5. Update local state for immediate UI refresh
6. Show toast with count of replacements made
```

The correction badge display will use a lightweight diff — compare `applyCorrections(text)` against original, and if different, show a small indicator like: `🔤 2 name corrections available`.

