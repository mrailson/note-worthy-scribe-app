## Recover Stephanie Allen's missing PCN Board meeting

### What I found

- User: **Stephanie Allen** (`stephanie.allen19@nhs.net`, id `ce00b066-…`).
- The `meetings` row for this afternoon's recording is **gone** (no row in `meetings`, no row in `meetings_archive`).
- The recording itself is **fully preserved** as 72 transcript chunks in `meeting_transcription_chunks` under meeting id `41ec0c85-147f-4817-8e36-8ca3068995cb`:
  - First chunk 12:47 BST, last chunk 14:53 BST.
  - Internal segment timestamps run 0 s → 6 190 s ≈ **1 h 43 m** of audio.
  - **18 718 words** of validated Whisper transcript, all `is_final=true, validation_status=validated`.
- Two `meeting_groups` named "PCN Board Meeting" were set up by her this morning (09:05 and 11:52 BST) — consistent with her account that she configured groups + agenda before recording.
- One generation attempt fired at 11:48 BST on the very first 371-word snippet and Sonnet refused it as `skip_reason: llm_refused_non_meeting` (classified `test_recording`). After that there is no further generation log, so notes were never produced.
- A separate small (24 s, 78-word) test backup `b3f3401c-…` exists from 19:13 BST — that's a later mic check, not the lost meeting.
- Audio backup for the lost meeting is **not** in `meeting_audio_backups` (no file path), so we cannot re-transcribe from raw audio — but we don't need to: the validated transcript is intact.

### Cause (most likely)

The parent `meetings` row was deleted by a path that bypassed the `meetings_archive` trigger (hard delete, or cascaded from `folder_id` removal). Transcript chunks have no ON-DELETE-CASCADE on `meeting_id`, which is why they survived. The early "test_recording" refusal also means no auto-generated title/notes were ever stored on the row, so deletion would not have warned the user about losing them.

### Recovery plan

1. **Re-insert the meeting row** with the original id `41ec0c85-147f-4817-8e36-8ca3068995cb` so all 72 surviving chunks reconnect:
   - `user_id` = Stephanie's id
   - `title` = "PCN Board Meeting (recovered)"
   - `start_time` = first chunk created_at (12:47 BST)
   - `end_time` = last chunk created_at (14:53 BST)
   - `duration_minutes` = 103
   - `status` = `completed`
   - `notes_generation_status` = `pending`
   - `chunk_count` = 72
   - `meeting_type` / `format` = sensible defaults matching her usual PCN board template
   - link to her practice via `practice_id` if resolvable
2. **Re-link to the right meeting group** — there are two "PCN Board Meeting" groups created today; attach the recovered meeting to the later one (11:52 BST, id `5f55a42e-…`) since that matches the recording start.
3. **Stitch the transcript** from `meeting_transcription_chunks` (ordered by `chunk_number`/`created_at`) into the meeting's `whisper_transcript_text` (and `best_of_all_transcript`) so existing readers find content immediately.
4. **Trigger notes generation** via the standard pipeline (Sonnet 4.6, per project rules) using the stitched transcript. This time the transcript is long and substantive, so the "test_recording" refusal that fired at 11:48 won't repeat.
5. **Add a hard safeguard so this can't repeat:**
   - Soft-delete pattern for `meetings`: route deletes through the existing `meetings_archive` write so a row is always preserved.
   - Add a confirmation guard in the meeting list UI when a meeting has > N transcript chunks (e.g. > 5) — *"This meeting has X minutes of transcript that will be lost. Type DELETE to confirm."*
   - Add a `before delete` trigger on `meetings` that copies `id, user_id, title, duration_minutes, word_count, start_time, end_time` into `meetings_archive` and additionally tags it when surviving chunks exist, so we can offer one-click restore in future.

### Out of scope (won't touch)

- Existing meeting templates, AssemblyAI/Deepgram code paths, or the complaints indemnity work from earlier today.
- Stephanie's other recordings — only the lost one is rebuilt.

### What I need from you before I run it

Please confirm:
1. Title to use for the recovered meeting (default suggestion: **"PCN Board Meeting — 12 May 2026 (recovered)"**).
2. OK to attach to her later meeting group `5f55a42e-…` ("PCN Board Meeting", 11:52 BST)?
3. OK to also implement the safeguard (soft-delete + delete-confirmation + before-delete trigger) in this same change?
