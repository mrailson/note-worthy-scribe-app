

## Plan: Auto-Generate Notes, Title, Overview & Email After Reprocessing

### Problem

The current reprocessing flow transcribes all audio segments and saves the combined transcript, but then **stops**. It does not trigger:
- Meeting notes generation
- AI meeting title
- Meeting overview/summary
- Auto-email delivery

These are all handled by the existing `auto-generate-meeting-notes` edge function, which simply needs to be invoked after the transcript save completes.

### Solution

**File: `src/components/AudioBackupManager.tsx`**

After the successful `save` action (line ~414), add a post-processing step:

1. **Call `auto-generate-meeting-notes`** with `{ meetingId, forceRegenerate: true }` — this single call generates notes (all styles), the AI title, and the meeting overview.
2. **Call `ensureMeetingTitle`** as a safety net (already exists in `manualTriggerNotes.ts`).
3. **Show progress toasts**: "Generating meeting notes and title…" → "Meeting notes generated — email sent".
4. **Handle failure gracefully**: If note generation fails, show a warning but don't lose the transcript (which is already saved).

### What Already Happens Inside `auto-generate-meeting-notes`

This edge function already:
- Reads `whisper_transcript_text` from the meetings table (which reprocessing just saved)
- Generates notes in multiple styles via Claude
- Generates an AI meeting title
- Generates a meeting overview/summary
- Triggers the auto-email with the meeting content

So no new edge functions or database changes are needed — just one additional function call from the client after the save step.

### Technical Detail

```text
reprocessAudio()
  ├── Step 1: List segments          (existing)
  ├── Step 2: Transcribe each        (existing)
  ├── Step 3: Save transcript        (existing)
  ├── Step 4: Generate notes + title (NEW)
  │     └── supabase.functions.invoke('auto-generate-meeting-notes', 
  │           { meetingId, forceRegenerate: true })
  └── Step 5: Ensure title safety    (NEW)
        └── ensureMeetingTitle(meetingId)
```

### Files Modified

- `src/components/AudioBackupManager.tsx` — add Steps 4 and 5 after the save action, with toast progress indicators

### No edge function changes or database migrations required.

