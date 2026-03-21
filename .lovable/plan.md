

## Add QC Pass Toggle to Microphone Settings

### What
Add a "Quality Control Pass" on/off switch to the Meeting Recorder's Microphone Settings panel (the right-side sheet). Default: **off**. When off, both edge functions skip the Haiku QC audit entirely, saving ~16s per meeting.

### Changes

**1. Frontend — `src/components/meeting/MeetingMicrophoneSettings.tsx`**
- Add a new section after the "Help text" (before closing `</div>`) with a divider, label "Quality Control Pass", description text, and a Switch component
- Read/write the setting to `localStorage` key `meeting-qc-enabled` (default `false`)
- Expose via a callback prop `onQcEnabledChange` so the parent can pass it downstream

**2. Frontend — `src/components/MeetingRecorder.tsx`**
- Read `localStorage.getItem('meeting-qc-enabled')` and pass `skipQc: true/false` in the body when invoking `auto-generate-meeting-notes`
- Same for any direct calls to `generate-meeting-notes-claude`

**3. Frontend — All other call sites** (FullPageNotesModal, SafeModeNotesModal, MeetingHistory, MeetingSummary, MobileNotesSheet, etc.)
- Read the same localStorage key and pass `skipQc` in the request body to `generate-meeting-notes-claude`

**4. Edge function — `supabase/functions/auto-generate-meeting-notes/index.ts`**
- Destructure `skipQc` from the request body (default `false`)
- Wrap the QC block (lines ~1695–1838) in `if (!skipQc) { ... }` 
- When skipped, set `qcResult = { status: 'skipped', reason: 'disabled_by_user' }` and `qc_audit_seconds: 0`

**5. Edge function — `supabase/functions/generate-meeting-notes-claude/index.ts`**
- Destructure `skipQc` from the request body (line ~490)
- Wrap the QC block (lines ~714–835) in `if (!skipQc) { ... }`
- Same skip result pattern

### UI placement
In the Microphone Settings sheet, after the tip text, add:
- A subtle divider
- "Quality Control Pass" label with Shield icon
- Description: "Run a QC audit after note generation (~15-20s). Checks for fabricated decisions, missing speakers, and other issues."
- Switch toggle (off by default)

