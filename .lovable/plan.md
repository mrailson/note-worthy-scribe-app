

# Replace Old Attendee Modal with New LiveImportModal

## Summary
Replace the old `MeetingAttendeeModal` component with the newer `LiveImportModal` (defaulting to the Attendees tab) in three locations:
1. **SafeModeNotesModal** - the people icon during live recording
2. **FullPageNotesModal** - the people icon in the notes view
3. **MeetingHistoryList** - the "Manage Attendees" button on meeting cards

## Why
The new `LiveImportModal` / `MeetingAttendeesTab` system has superior UX: group loading, directory search, individual add/remove, and syncs via `meeting_attendees_json`. The old `MeetingAttendeeModal` uses a different data model (`meeting_attendees` junction table) and lacks the newer features.

## Changes

### 1. SafeModeNotesModal.tsx
- Replace `MeetingAttendeeModal` import with `LiveImportModal`
- Swap the rendered `<MeetingAttendeeModal>` for `<LiveImportModal>` with `defaultTab="attendees"` and the meeting ID
- Keep existing open/close state variables

### 2. FullPageNotesModal.tsx
- Same swap: replace `MeetingAttendeeModal` import and usage with `LiveImportModal`
- Pass `defaultTab="attendees"` and `meetingId={meeting.id}`

### 3. MeetingHistoryList.tsx
- Same swap: replace `MeetingAttendeeModal` import and usage with `LiveImportModal`
- Pass `defaultTab="attendees"` and `meetingId={selectedMeetingForAttendees.id}`

### Technical Details
- All three files currently import from `@/components/MeetingAttendeeModal` — change to `@/components/meeting/import/LiveImportModal`
- The `LiveImportModal` accepts `{ open, onOpenChange, defaultTab, meetingId }` — map from the existing `isOpen`/`onClose` pattern to `open`/`onOpenChange`
- The old modal's `meetingTitle` prop is not needed (LiveImportModal doesn't use it)
- No changes needed to `MeetingAttendeesTab` — it already handles loading/saving attendees by `meetingId`

