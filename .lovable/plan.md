

## Problem

The mobile export sheet (`MobileExportSheet`) currently only offers Word document downloads (notes, transcript, quality summary) and a share option. There is no way to email meeting notes directly from the smartphone -- a feature that exists on desktop via `useAutoEmail`. The email should include the notes in the email body and attach a Word document.

## Plan

### 1. Add "Email Notes" option to MobileExportSheet

Add a new button to `MobileExportSheet.tsx` between "Meeting notes (.docx)" and "Full transcript (.docx)":

- Icon: `Mail` (lucide) with a purple/violet accent background
- Label: "Email notes to me"
- Detail: "Send notes with Word attachment to your email"

### 2. Implement email handler

In `MobileExportSheet.tsx`:
- Import and use the `useAutoEmail` hook
- Create `handleEmailNotes` that:
  1. Fetches meeting data (reuses existing `fetchMeetingData`)
  2. Calls `sendEmailAutomatically(notesContent, subject)` with a subject like "Meeting Notes - {title} - {date}"
  3. Shows success/error toast and closes the sheet
- Disable the button and show a spinner while `isSending` is true

### 3. Files changed

- `src/components/mobile-meetings/MobileExportSheet.tsx` -- add Mail import, useAutoEmail hook, email handler, and new button option

No new files or database changes needed. The existing `useAutoEmail` hook already handles Word attachment generation and email sending via the Supabase edge function.

