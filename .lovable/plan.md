

## Fix Backup Audio Upload and Investigate Early Meeting End

### Problem Summary
Two issues have been identified:

### Issue 1: Backup Audio Never Uploads (Root Cause Found)
The `meeting-audio-backups` storage bucket is **missing an INSERT (upload) policy**. The bucket has SELECT and DELETE policies, but no policy allowing users to upload files. This means every backup upload attempt is silently rejected by Supabase RLS, which is why the `meeting_audio_backups` table is always empty and the BackupBadge never appears.

### Issue 2: Meeting Ending Early When Switching to History Tab
Investigation shows that switching between tabs (Recorder/Transcript/History) within `MeetingRecorder` is a simple React state change -- no component unmounting or navigation occurs. The recording should continue unaffected. On iPhone, the `SimpleIOSTranscriber` already monitors for track endings and has stream recovery. The 2-minute test meeting completed successfully with notes generated, so this may have been a coincidental manual stop rather than a code bug. However, we should add a safety warning when switching tabs during recording.

---

### Plan

#### Step 1: Add Storage INSERT Policy (Critical Fix)
Create a SQL migration to add an INSERT policy on `storage.objects` for the `meeting-audio-backups` bucket, allowing authenticated users to upload to their own folder (matching the existing SELECT/DELETE pattern).

```sql
CREATE POLICY "Users can upload their meeting audio backups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'meeting-audio-backups'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

Also add an UPDATE policy (needed for `upsert: true` in the upload code):

```sql
CREATE POLICY "Users can update their meeting audio backups"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'meeting-audio-backups'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

#### Step 2: Add Better Upload Error Logging
Update `backupUploader.ts` to log the specific error when upload fails, so we can diagnose issues more easily in future.

#### Step 3: Add Tab-Switch Warning During Recording (Optional Safety)
When the user switches to the History tab whilst recording is active, show a brief informational toast reminding them that recording continues in the background. This provides reassurance without blocking the action.

---

### Expected Outcome
- After Step 1, backup audio will successfully upload to Supabase Storage
- The `meeting_audio_backups` table will receive metadata records
- The BackupBadge will appear in the transcript tab showing file size and duration
- Users get reassurance when switching tabs during recording

