## Goal

Make it faster for management users to log claim time in the **NRES Management Time** tab by:

1. Letting them upload a Word doc, PDF or image describing the work they did. Dates, start/end times, hours and descriptions are extracted automatically and shown in a review table they can tick/edit before pushing into the entries list.
2. Defaulting the work-date picker to the current calendar month (e.g. "April") rather than empty.
3. Remembering the last month they worked in, plus their last-used start time and end time, so repeat entries are quicker.

Single screen affected: `src/components/nres/hours-tracker/ManagementTimeTab.tsx` (the "Add Time Entry" form section).

## Changes

### 1. Document import + auto-extract

Add a new collapsible block above the manual "Add Time Entry" form titled **"Import claim details from a document"**, containing:

- A drop zone / file picker accepting `.docx`, `.pdf`, `.png`, `.jpg`, `.jpeg` (max 10 MB).
- On upload, the file is sent (as a base64 data URL) to the existing `extract-document-text` edge function — which already handles DOCX, PDF and image OCR — to get raw text.
- The raw text is then sent to a new edge function `extract-management-time-entries` (Lovable AI Gateway, `google/gemini-2.5-flash`) with a strict JSON schema prompt that asks for an array of entries:
  ```json
  [{ "work_date": "2026-04-12", "start_time": "09:00", "end_time": "12:30", "hours": 3.5, "description": "Programme Board prep" }]
  ```
  The prompt enforces British date parsing (DD/MM/YYYY), 24-hour times shown as HH:mm, and computes `hours` from start/end if both present.
- Extracted rows render in a **Review extracted entries** table with one row per entry: editable Date, Start, End, Hours, Description columns, plus an "Include" checkbox (default ticked) and a per-row delete.
- A single **Person** selector at the top of the review table applies to all imported rows (the document rarely identifies the person, so the user picks once).
- An **"Add selected to entries"** button calls the existing `addEntry` hook in a loop for each ticked row, then clears the review table.

If the AI returns no rows or fails, show a clear toast and keep the manual form usable.

### 2. Default the work date to the current calendar month

Currently `workDate` is `undefined` until the user picks a date. Change initial state to `new Date()` so the calendar opens on today and the date input shows today's date (which lives in the current calendar month, e.g. April). The existing `claimMonthForDate` helper already derives the right `claim_month` from the chosen date, so this just gives the user a sensible starting point and an "April" claim month by default.

### 3. Persist last month, start time and end time

Today the form has only a `Date` field and a numeric `Hours` field. Add two new fields **Start time** and **End time** (HTML `<input type="time">`, 24-hour) above the Hours input. When both are filled, `Hours` auto-calculates as `(end - start) / 60` rounded to 0.25, but remains editable so the user can override.

Persistence (localStorage, scoped per user via the existing `useAuth` user id where available, otherwise a global key):

- `nres-mgmt-last-month` — yyyy-MM string of the most recently used `work_date`'s month. Restored on mount; if found, the date picker defaults to the 1st of that month instead of today.
- `nres-mgmt-last-start` — HH:mm string, restored into Start time on mount and updated whenever the user changes it.
- `nres-mgmt-last-end` — HH:mm string, same behaviour for End time.

Saved on every change (debounced via a small effect) and on successful `Add Entry`.

### 4. Small UX polish

- Show the resolved claim month (e.g. **"April 2026"**) as a small caption next to the date picker so the user can confirm which monthly claim the entry will roll into.
- The cost preview line (existing `hours × rate = total`) updates from the new auto-calculated hours.

## Technical details

**Files edited**
- `src/components/nres/hours-tracker/ManagementTimeTab.tsx` — add document import block, review table, time-range inputs, defaults and localStorage persistence.

**Files created**
- `supabase/functions/extract-management-time-entries/index.ts` — Deno edge function:
  - Accepts `{ text: string }`.
  - Calls Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`, model `google/gemini-2.5-flash`) with `tool_choice` forcing a JSON tool call returning `{ entries: [...] }`.
  - System prompt: British English, strict ISO date output, 24-hour times, hours rounded to 0.25, ignore narrative not tied to a date, drop entries with no resolvable date.
  - Inline CORS headers, `Deno.serve()`, handles 429/402 with friendly messages (per existing edge-function standards).

**Reused, no changes needed**
- `extract-document-text` edge function — used as-is for DOCX/PDF/image OCR.
- `useNRESManagementTime.addEntry` — called once per imported row to persist entries.

**No DB schema or RLS changes.** Imported rows write through the existing entry shape; nothing new is stored beyond what the manual form already produces.

## Out of scope

- Auto-detecting which person performed the work (kept manual via the single Person selector at the top of the review table).
- Bulk delete / bulk status changes on existing entries.
- Changes to other claim categories (Buy-Back, GP Locum, New SDA) — this work is scoped to the NRES Management Time tab as requested.
