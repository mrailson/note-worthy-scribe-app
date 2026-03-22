

## Problem Diagnosis

Two bugs are causing meeting note generation to fail on desktop:

### Bug 1: `generationMetadata is not defined` (line 1858)
The `auto-generate-meeting-notes` edge function references a variable `generationMetadata` at line 1858 that was never declared. This causes the entire function to crash with a `ReferenceError` every time it tries to save the generated notes — meaning notes are generated successfully but never saved.

### Bug 2: Wrong edge function being called
Per the project's architecture memory, ALL note generation should route through `generate-meeting-notes-claude`. However, `MeetingRecorder.tsx` (the desktop recording flow) still calls `auto-generate-meeting-notes` directly. This is the function the user keeps saying is "the wrong one."

---

## Plan

### Step 1: Fix the undefined variable crash in `auto-generate-meeting-notes`
In `supabase/functions/auto-generate-meeting-notes/index.ts` at line 1858, construct the `generationMetadata` object before the upsert call. It should capture model used, generation time, QC results, and token stats — data already available in surrounding variables (`notesGenEnd`, `qcResult`, `modelOverride`, etc.).

### Step 2: Redirect desktop recording to `generate-meeting-notes-claude`
In `src/components/MeetingRecorder.tsx` around line 5897, change the function invocation from `auto-generate-meeting-notes` to `generate-meeting-notes-claude`, passing the transcript in the request body (as other call sites already do). This aligns with the unified pipeline architecture.

### Step 3: Redeploy the edge function
Deploy the fixed `auto-generate-meeting-notes` so that any other call sites (history list, import, regenerate) also stop crashing.

