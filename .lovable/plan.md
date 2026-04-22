

## Plan: Download All Segments for a Meeting Audio Backup

### Problem
The `downloadAudio` function only downloads `backup.file_path` (a single file). Backups with multiple segments in a storage folder only get the first file downloaded.

### Solution
Update `downloadAudio` in `src/components/AudioBackupManager.tsx` to:

1. **Use the already-enriched `segmentDetails`** from the backup object to know how many segments exist and their file paths.
2. **If multiple segments exist**, download each one sequentially from the storage folder, then combine all Blobs into a single file before triggering the download. This gives the user one consolidated `.webm` file per meeting.
3. **If only one segment** (or no `segmentDetails`), fall back to the current single-file download behaviour.
4. **Show progress** via toast updates (e.g. "Downloading segment 2 of 4…").

### Technical Details

**File: `src/components/AudioBackupManager.tsx`**

- Derive the folder path from `backup.file_path` (strip the filename to get the directory).
- If `backup.segmentDetails` has multiple entries, iterate through each, calling `supabase.storage.from('meeting-audio-backups').download(folderPath + '/' + segment.name)` for each segment.
- Concatenate all downloaded Blobs into a single `new Blob([...allBlobs], { type: 'audio/webm' })`.
- Trigger the download of the combined blob with a filename like `audio_backup_{meeting_id}_{date}_all_segments.webm`.
- If any individual segment fails, log it and continue with the rest, then warn the user about partial downloads.

### Files Modified
- `src/components/AudioBackupManager.tsx` — rewrite `downloadAudio` function

