

## Plan: Bulk Import Attendees via Document Upload

### Overview
Add an "Import" tab to the Manage Attendees modal. Users upload a Word, Excel, PDF, or image file. The client extracts text using the existing `FileProcessorManager`, sends it to the existing `generate-demo-response` edge function (new `action: "extract-attendees"` branch), and the AI returns structured attendee data for review and approval.

### Changes

**1. Edge function: `supabase/functions/generate-demo-response/index.ts`**
- Add new `action === 'extract-attendees'` branch
- Receives `{ action: "extract-attendees", text: "..." }` — the raw extracted text from the document
- Calls the AI via Lovable Gateway with a prompt to extract attendees as JSON: `[{ name, email?, title?, role?, organization? }]`
- Returns the parsed array to the client

**2. New component: `src/components/meeting/AttendeeImportTab.tsx`**
- Drag-and-drop upload zone using `react-dropzone` (already installed)
- Accepts `.docx`, `.xlsx`, `.pdf`, `.jpg`, `.jpeg`, `.png`, `.csv`, `.txt`
- On file drop: uses `FileProcessorManager` to extract text client-side, then calls `supabase.functions.invoke('generate-demo-response', { body: { action: 'extract-attendees', text } })`
- Displays extracted attendees in a review list with:
  - Checkbox per attendee (all checked by default)
  - Inline-editable fields: name, email, title, role, organisation
  - "Already exists" warning badge for duplicates (matched against `allAttendees` by name, case-insensitive)
  - "Select All / Deselect All" toggle
- Two action buttons: "Approve Selected" and "Approve All"
- On approval: inserts each approved attendee into `attendees` table (using same `saveNewAttendee` pattern), refreshes the list, and auto-selects them in the Quick Pick tab

**3. Modify: `src/components/MeetingAttendeeModal.tsx`**
- Add 5th tab "Import" with upload icon between "Manage Attendees" and "Distribution Lists"
- Change `grid-cols-4` to `grid-cols-5` on TabsList
- Render `<AttendeeImportTab>` passing `allAttendees`, `userPracticeIds`, `user`, and a callback to refresh attendees + auto-select imported ones

### No new edge functions, no database changes required.

