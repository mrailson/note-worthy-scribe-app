

## Fix: `[object Object]` in live transcript

### Problem
The transcript preview shows `[object Object]` because the Deepgram and Browser Speech transcribers pass a `TranscriptData` object (with `.text`, `.speaker`, `.confidence` fields) to `onTranscription`, but the code treats the argument as a plain string.

### Root Cause
In `NoteWellRecorderMobile.jsx` line ~621, the `onTranscription` callback receives `(text)` but `text` is actually a `TranscriptData` object. The `String(text)` coercion produces `[object Object]`.

### Fix (1 file)

**`src/components/recorder/NoteWellRecorderMobile.jsx`** — In the `createTranscriber` callback (~line 621):

```javascript
onTranscription: (data) => {
  const t = typeof data === "string" ? data : (data?.text ?? String(data || ""));
  if (!t.trim()) return;
  setLiveTranscript(prev => {
    const p = typeof prev === "string" ? prev : "";
    const updated = p ? p + " " + t : t;
    setLiveWordCount(updated.split(/\s+/).filter(Boolean).length);
    return updated;
  });
},
```

This extracts `.text` from the `TranscriptData` object for Deepgram and Browser Speech, while still handling plain strings from AssemblyAI.

