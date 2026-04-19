
Goal: fix why saved practice letterheads are not being used in complaint letters, confirm letterheads are scoped to the logged-in user’s practice(s), and show the current practice clearly on the Practice Letterhead page.

What I found
1. The settings page and the generated letter preview are using different data paths.
   - Settings page signs and previews `storage_path` (the original PDF/DOCX).
   - Generated letters still call `getActiveLetterhead()` in `src/utils/practiceLetterhead.ts`, which only reads/signs `rendered_png_path`.
2. Your screenshots and network data support that:
   - Letterhead settings shows the Byfield PDF from `.../originals/...Headed_paper.pdf`.
   - The complaint letter preview is still requesting `.../rendered/...letterhead.png`, and that PNG is the old Oak Lane image.
3. The complaints letter preview does pass `complaint.practice_id`, so the preview component is asking for the complaint’s practice. The problem is the resolver/helper logic, not the modal itself.
4. If letterhead lookup fails, `FormattedLetterContent` falls back to legacy practice logo logic from `practice_details`, which explains why Oak Lane still appears.
5. Practice scoping looks broadly correct already:
   - The settings page only loads practices from `get_user_practice_ids(user.id)`.
   - Upload sends the selected `practice_id`.
   - The edge function checks `can_manage_practice_letterhead(_practice_id)` against the caller’s authorised practices.
   This means letterheads should only be saved for practices the logged-in user is allowed to manage.
6. There is still one reliability gap:
   - `getActiveLetterhead()` uses `.maybeSingle()` with no ordering and only looks at `active = true`.
   - If more than one row is still marked active for a practice from older data, selection is brittle.

Implementation plan
1. Unify letterhead resolution
   - Update `src/utils/practiceLetterhead.ts` so the active letterhead model includes:
     - `storage_path`
     - `original_mime_type`
     - `rendered_png_path` as optional
   - Make it prefer the original uploaded file when present, not just `rendered_png_path`.
   - Order by newest active record to avoid ambiguous selection.

2. Fix complaint/preview rendering to use the saved original file
   - Update `src/utils/letterheadToImage.ts` to use the original file path + mime type from the active row.
   - Keep PDF.js for PDFs and Mammoth/html2canvas for DOCX.
   - Only fall back to legacy logo when there is genuinely no active practice letterhead.

3. Fix email/Word export paths
   - Update `src/utils/formatLetterForEmail.ts` and `src/utils/letterFormatter.ts` to use the same unified active-letterhead data.
   - Ensure exports no longer depend on stale `rendered_png_path` rows.
   - This keeps on-screen preview, email output, and Word download consistent.

4. Make active-row selection robust
   - Update the active letterhead query to prefer:
     - `active = true`
     - latest `uploaded_at` / `created_at`
   - Add a defensive cleanup step if needed so older duplicate active rows do not win.

5. Verify practice scoping end-to-end
   - Review the complaint letter generation flow to confirm it always uses `complaint.practice_id`.
   - If any path still falls back to the logged-in user’s default practice before trying the complaint’s practice, correct that order.
   - Confirm the settings page cannot upload/manage a practice outside `get_user_practice_ids()`.

6. Improve the Practice Letterhead page
   - Always show which practice is being configured, even when the user only has one practice.
   - For multiple practices, keep the selector.
   - For a single practice, show a clear non-editable label such as “Current practice: Byfield Medical Centre”.
   - Optionally also show the practice name on the active letterhead card for clarity.

Technical notes
- Files likely to change:
  - `src/utils/practiceLetterhead.ts`
  - `src/utils/letterheadToImage.ts`
  - `src/components/FormattedLetterContent.tsx`
  - `src/utils/formatLetterForEmail.ts`
  - `src/utils/letterFormatter.ts`
  - `src/pages/complaints/LetterheadSettings.tsx`
- Likely no database schema change is required unless we decide to harden data further.
- If duplicate active rows exist, I may add a small migration to normalise them safely.

Expected outcome
- The Byfield letterhead shown on the settings page will also appear in complaint preview, email, and Word download for complaints belonging to Byfield.
- Oak Lane will only appear for Oak Lane complaints, or as a fallback when no Byfield letterhead exists.
- The Practice Letterhead page will clearly state which practice is being configured.
