## Goal

Surface, in the **Today's Meetings** hover card on the Meeting Usage Report (`/admin`), the **recording method** used for each meeting and the **word count of every transcription engine** that produced text — so you can see at a glance which engine worked, which fell short, and what platform was used.

## What will appear in the hover card

For every meeting in the hover, beneath the existing Title / Start / End / Duration / Words line, add two new rows:

```
Method   Chrome (Desktop)
Engines  Best-of-all 1,240  ·  Assembly 1,210  ·  Whisper 1,198  ·  Live 980
```

- **Method** — derived from existing fields on `meetings`:
  - `import_source = 'mobile_live'` → "Mobile (Live)"
  - `import_source = 'mobile_offline'` → "Mobile (Offline)"
  - otherwise use `device_browser` + `device_type` → e.g. "Chrome (Desktop)", "Edge (Desktop)", or "Unknown"
- **Engines** — word count for each transcript field that has content. The one matching `primary_transcript_source` is shown in **bold green** so the chosen output is obvious; the others are muted so shortfalls (e.g. Whisper way lower than Assembly) are easy to spot.
  - `best_of_all_transcript` → "Best-of-all"
  - `assembly_transcript_text` (or `assembly_ai_transcript`) → "Assembly"
  - `whisper_transcript_text` → "Whisper"
  - `live_transcript_text` → "Live"
  - Engines with empty/null transcripts are omitted.

## Technical approach

1. **Extend the RPC `get_todays_meetings_details`** (DB migration) to return the additional columns:
   - `import_source`, `device_browser`, `device_type`, `primary_transcript_source`
   - `assembly_words`, `whisper_words`, `live_words`, `best_of_all_words` — computed server-side as `array_length(regexp_split_to_array(coalesce(<col>,''), '\s+'), 1)` (or 0 when empty), so the client never receives full transcript text.
2. **Update `TodaysMeeting` interface** in `MeetingUsageReport.tsx` with the new fields.
3. **Add two helpers** in the same file:
   - `formatMethod(meeting)` → returns the method label.
   - `engineList(meeting)` → returns an ordered array `[{label, words, isPrimary}]`, filtered to engines with words > 0.
4. **Render** the new "Method" and "Engines" rows inside the existing hover card block (around lines 516–525). Keep typography consistent with the existing `text-xs text-muted-foreground` style; primary engine uses `text-green-700 font-medium`.
5. No change to the table layout or sorting — purely additive content inside the existing hover card.

## Out of scope

- No change to the 7-day / 30-day / All-time hover popovers (they already show different summaries; can be done in a follow-up if you want the same treatment there).
- No new column on the main user table.
