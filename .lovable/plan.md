

## Auto-Transcribe and AI Review for Audio Evidence

### Overview
When audio files (MP3, WAV, etc.) are uploaded as evidence, the system will automatically transcribe the audio, run an AI review, and store both the transcript and the structured AI analysis. The AI review will also appear in the Word download report. The file size limit for audio files will increase from 10MB to 20MB.

### What Changes

**1. Increase audio file size limit to 20MB**
- Update the `MAX_FILE_SIZE` constant in `InvestigationEvidence.tsx` for audio files
- Keep the 10MB limit for non-audio files to avoid storage bloat
- Update the upload hint text to reflect the new limit

**2. Auto-transcription is already working**
- The `analyse-evidence-file` edge function already calls `speech-to-text` for audio files and returns a transcript
- The `InvestigationEvidence.tsx` component already auto-saves the transcript to `complaint_investigation_transcripts`
- No changes needed for transcription itself

**3. Store AI audio review alongside transcript**
- The `analyse-evidence-file` edge function already generates an AI analysis of audio content (tone, staff/patient behaviour, complaint handling, lessons). This analysis is currently stored in the `ai_summary` field of the evidence record.
- However, it's only shown as a truncated 2-line preview in the Evidence Files tab. The full review needs to be viewable.

**4. Add "View AI Review" to evidence file list**
- Add an expandable section or modal to view the full `ai_summary` (which contains the structured AI review) for audio files in the Evidence Files tab
- This makes the full Call Summary, Tone Assessment, Patient Behaviour, Staff Behaviour, Complaint Handling, and Lessons sections visible without leaving the page

**5. Include Audio Evidence AI Review in Word Report**
- Update `exportComplaintReportToWord` in `src/utils/exportComplaintReport.ts` to accept audio evidence data (transcripts and AI reviews)
- Add a new "Audio Evidence Analysis" section to the Word report, placed between Evidence and Investigation Findings
- For each audio file with a transcript and AI review, include:
  - File name, upload date, duration
  - Full transcript text
  - AI Review sections: Call Summary, Tone Assessment (staff and patient), Complaint Handling Assessment, Patient Behaviour, Staff Behaviour, Key Lessons and Recommendations, Training Requirements
- Update the `ReportData` interface to include audio evidence data
- Update all call sites in `ComplaintDetails.tsx` to fetch and pass audio evidence data

### Technical Details

**File changes:**

| File | Action | Purpose |
|------|--------|---------|
| `src/components/InvestigationEvidence.tsx` | Edit | Allow 20MB for audio files; add expandable AI review view for audio evidence |
| `src/utils/exportComplaintReport.ts` | Edit | Add `audioEvidenceReviews` to `ReportData` interface; add "Audio Evidence Analysis" section to Word report |
| `src/pages/ComplaintDetails.tsx` | Edit | Fetch audio transcripts and AI reviews, pass to `exportComplaintReportToWord` |

**No new edge functions or database changes required.** The existing `analyse-evidence-file` already generates the structured AI review and returns a transcript. The data is already being stored in the `complaint_investigation_evidence.ai_summary` and `complaint_investigation_transcripts` tables.

**Audio file size handling:**
- The `onDrop` callback will check if a file is audio and apply a 20MB limit, while keeping 10MB for other file types
- The dropzone hint text will be updated to mention "Audio up to 20MB, other files up to 10MB"

**Word report "Audio Evidence Analysis" section structure:**
For each audio evidence file:
- Heading with file name
- Metadata table (file size, upload date, duration if available)
- Full AI review (parsed from markdown in `ai_summary`)
- Full transcript text (from `complaint_investigation_transcripts`)

**Evidence Files tab "View AI Review" expansion:**
- When an audio file has an `ai_summary` longer than the 2-line preview, show a "View AI Review" button
- Clicking it opens a dialog/modal displaying the full AI review in formatted markdown
- The review is already generated on upload, so this is a display-only change

