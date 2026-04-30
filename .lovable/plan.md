I’ll update `src/components/meeting/import/CreateMeetingTab.tsx` only, leaving `useMeetingImporter.ts` unchanged.

Implementation plan:

1. Add the existing hook import
   - Add `import { useMeetingImporter } from '@/hooks/useMeetingImporter';` alongside the existing imports.

2. Initialise the importer inside `CreateMeetingTab`
   - Add:
     ```ts
     const { importMeeting, isImporting, progress: importProgress, currentStep: importStep } = useMeetingImporter();
     ```
   - Keep the existing local UI state such as `isCreating`, `importSuccess`, uploaded files, trimming, and preview logic.

3. Replace only the database/write portion of `handleCreateMeeting`
   - Keep the existing checks for logged-in user and empty transcript.
   - Keep the title fallback:
     ```ts
     Imported Meeting - ${new Date().toLocaleDateString('en-GB')}
     ```
   - Replace the direct `meetings` insert, `meeting_transcripts` insert, and direct `auto-generate-meeting-notes` call with:
     ```ts
     const meetingId = await importMeeting({
       transcript,
       title,
       attendees: [],
       source: 'text_import',
     });
     ```
   - Then set:
     ```ts
     setImportedMeetingId(meetingId);
     setImportSuccess(true);
     ```

4. Keep user-facing behaviour consistent
   - The file upload, audio trimming, document extraction, transcript preview, and Word download logic will not be changed.
   - The create button can continue using existing `isCreating`; I’ll also ensure it is disabled while the hook is importing so duplicate submissions are blocked.
   - If appropriate, the button text can surface the hook’s current step/progress during import, without altering the wider UI.

5. Remove obsolete code from this component
   - Remove now-unused calculations such as `wordCount` / `estimatedMinutes` from `handleCreateMeeting` if they are only used for the old direct insert.
   - Remove the direct `auto-generate-meeting-notes` invocation from this path.
   - Retain the `supabase` import because the component still uses it for transcription, document extraction, and storage-based processing.

Expected result:
- Imported/pasted meetings created from this tab will go through the same complete pipeline as `useMeetingImporter`: `import_source`, attendee auto-add, transcript storage, queue insertion, model override, overview generation, executive notes, and limerick notes.