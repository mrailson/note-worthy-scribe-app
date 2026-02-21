

## Large WAV File Chunked Transcription (No New Edge Function)

### Approach
Add a `"process-large-audio"` action branch to the existing **`speech-to-text`** edge function, avoiding any new function deployment.

### How It Works

```text
Client (browser)
  |-- File > 25MB? Upload to Supabase Storage (audio-imports/temp/...)
  |-- Call speech-to-text with { action: "process-large-audio", storagePath, fileName }
  |
  v
speech-to-text edge function (existing)
  |-- action === "process-large-audio"?
  |     YES --> Download from Storage
  |           --> Parse WAV header (sample rate, channels, bits)
  |           --> Split PCM data into ~20MB chunks with proper WAV headers
  |           --> Transcribe each chunk via Whisper (reusing existing logic)
  |           --> Stitch transcripts sequentially
  |           --> Delete temp file from Storage
  |           --> Return combined transcript
  |     NO  --> Existing base64 transcription flow (unchanged)
```

### Technical Changes

**1. `supabase/functions/speech-to-text/index.ts`** -- Add large-audio branch

- Parse incoming JSON for `action` field
- When `action === "process-large-audio"`:
  - Download file from `audio-imports` bucket via Supabase Storage REST API
  - Parse WAV header (44 bytes): extract `sampleRate`, `numChannels`, `bitsPerSample`
  - Calculate `bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8)`
  - Target chunk size = 20MB (safe under 25MB Whisper limit)
  - For each chunk: prepend a valid WAV header, send to Whisper API (reusing existing retry + hallucination filtering logic)
  - Concatenate transcripts with newline separation
  - Delete the temp storage file
  - Return `{ text, duration, chunks: N }`
- Default path (no `action` field) remains completely unchanged

**2. `src/components/meeting/MultiAudioImport.tsx`**

- Remove the 25MB file size rejection (lines 159, 172-174)
- Update help text from "Max 25MB each" to "Large files auto-chunked"
- For files over 25MB:
  - Upload to `audio-imports/temp/{timestamp}-{id}.wav` via Supabase Storage
  - Call `speech-to-text` with `{ action: "process-large-audio", storagePath, fileName }`
  - Show progress: "Uploading..." then "Transcribing (chunk X of Y)..."
- For files under 25MB: existing base64 flow unchanged

**3. `src/components/meeting/import/CreateMeetingTab.tsx`**

- Update `transcribeAudioFile` (lines 95-157):
  - For files over 25MB: upload to Storage, call `speech-to-text` with `action: "process-large-audio"` instead of `assemblyai-transcription-url`
  - Keeps everything on Whisper for consistency
  - Temp file deletion handled server-side

### File Cleanup Guarantee

- WAV files are uploaded to `audio-imports/temp/` with timestamp paths
- The edge function deletes the file from Storage immediately after transcription (or on error via try/finally)
- No audio data is retained after processing

### Multiple Files

Both import components already process files sequentially in a loop -- each large file goes through the same upload-chunk-transcribe-delete pipeline independently. No changes needed for multi-file support.

