

## Plan: Fix Multi-Segment Reprocessing and Add Segment Info to Backup Cards

### Problem Analysis

The reprocess function works correctly in logic — it lists all segments (confirmed: 4 segments found for the test backup), then transcribes them one-by-one via Whisper. The likely failure point is:

1. **Edge function timeout**: Each ~10MB segment takes significant time to download from storage + upload to Whisper API + wait for transcription. Supabase edge functions have a wall-clock limit. After segment 0 succeeds, subsequent segments may hit the timeout or the client-side `supabase.functions.invoke` may time out.
2. **No visibility**: The UI shows segment progress during reprocessing, but the backup card itself doesn't show how many segments exist or their individual sizes — making it hard to diagnose issues before attempting reprocessing.

### Changes

**1. Add segment count and sizes to each backup card** (`src/components/AudioBackupManager.tsx`)

- On initial load (`fetchAudioBackups`), for each backup record, call the storage API to list files in the backup folder (derived from `file_path`) and count segments + individual sizes.
- Add a new field to the `AudioBackup` interface: `segmentDetails: { name: string; size: number }[]`.
- Display on each card: "Segments: 4 (9.2 MB, 9.2 MB, 9.3 MB, 9.1 MB)" in the metadata grid.
- Expand the grid from 3 to 4 columns to accommodate.

**2. Improve reprocessing resilience** (`supabase/functions/reprocess-audio-segment/index.ts`)

- Increase the Whisper `AbortSignal.timeout` from 120s to 150s to give more headroom for large segments.
- Add a `Content-Length` log before calling Whisper so failures can be diagnosed in logs.

**3. Improve client-side timeout handling** (`src/components/AudioBackupManager.tsx`)

- In `transcribeWithRetry`, increase the backoff delay between retries from 3s to 5s to reduce function boot contention.
- Add a longer delay between segments (2s instead of 1s) to allow edge function instances to cool down.

### Files Modified

- `src/components/AudioBackupManager.tsx` — add segment listing on load, display segment count/sizes on cards, adjust retry timing
- `supabase/functions/reprocess-audio-segment/index.ts` — increase timeout, add diagnostic logging

### No database or migration changes required.

