

# Add "Email Audio" Feature with Expandable Actions Menu

## Overview
Add an "Email Audio" button to the mobile recorder that emails the recording's audio chunks as attachments, splitting across multiple emails to stay under 15MB per email. Also restructure the "Reprocess" and new "Email Audio" buttons into a collapsible/expandable actions menu for cleaner UI.

## How It Works

1. User taps the "⋯ Actions" button on a transcribed recording
2. An expandable menu slides open showing "⟳ Reprocess" and "📧 Email Audio"
3. "Email Audio" reads the recording's audio chunks from IndexedDB, converts each to a Blob, then batches them into groups where total size stays under 15MB
4. Each batch is sent as a separate email via `send-meeting-email-resend` with base64-encoded audio attachments
5. Emails are numbered (e.g., "Audio Recording — Part 1 of 3") so the user knows how many to expect
6. Toast notifications show progress ("Sending email 2 of 3…") and final success

## Changes

### 1. Refactor `RecordingItem` — Expandable Actions Menu
**File:** `src/components/recorder/NoteWellRecorderMobile.jsx`

Replace the inline "⟳ Reprocess" button with a small "⋯" toggle button. When tapped, it expands a section below the recording info showing:
- **⟳ Reprocess** — existing functionality (unchanged)
- **📧 Email Audio** — new, sends audio chunks via email

Use a local `useState` inside `RecordingItem` to toggle the expanded state. The expanded section animates in with a simple max-height transition.

### 2. Add `emailAudio` Handler
**File:** `src/components/recorder/NoteWellRecorderMobile.jsx`

New async function `emailAudioRecording(rec)`:
- Gets user email from `supabase.auth.getSession()` → profile lookup
- Reads `rec.chunks` (ArrayBuffer data stored in IndexedDB)
- Converts each chunk to a base64 string
- Batches chunks into groups where cumulative size < 15MB (using raw byte size × 1.37 for base64 overhead)
- For each batch, calls `supabase.functions.invoke('send-meeting-email-resend', { body: { to_email, subject: "Recording: {title} — Part N of M", html_content: simple HTML body, audio_attachment: { content: base64, filename, type } } })`
- Since the edge function only supports a single `audio_attachment`, each chunk gets its own email if needed, or we modify the approach slightly:
  - Actually, the edge function builds an `attachments[]` array — we can extend it to accept `audio_attachments` (plural) as an array
  - Simpler approach: send one email per chunk, batching multiple small chunks into one email by modifying the edge function to accept an `attachments` array

### 3. Update Edge Function for Multiple Attachments
**File:** `supabase/functions/send-meeting-email-resend/index.ts`

Add support for a generic `extra_attachments` array field alongside the existing `word_attachment` and `audio_attachment` fields. This allows sending multiple audio files in one email:
```
extra_attachments?: Array<{ content: string; filename: string; type: string }>
```

### 4. Add `emailingIds` State
Track which recordings are currently being emailed (similar to `retranscribingIds`) to show spinner state on the button.

## Technical Details

- **Size calculation**: Each chunk's `sizeBytes` is stored in IndexedDB. Base64 encoding adds ~37% overhead, so effective limit per email is `15MB / 1.37 ≈ 10.9MB` of raw audio per email
- **MIME type**: Uses `rec.mimeType` (typically `audio/webm`) for the attachment type
- **Email subject**: `"{title} — Audio Part 1 of 3"` pattern
- **Email body**: Simple HTML: "Attached is part N of M of your recording '{title}' ({duration}). Total size: X MB across M emails."
- **User email**: Fetched from profiles table using the authenticated user's ID

### Files to Modify
- `src/components/recorder/NoteWellRecorderMobile.jsx` — expandable menu, email handler, state
- `supabase/functions/send-meeting-email-resend/index.ts` — support `extra_attachments` array

