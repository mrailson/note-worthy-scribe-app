

# Add "Manage" Link to Group Pill → Direct Edit

## What Changes

When the active group pill is shown at the bottom of PreMeetingSetup, add a "Manage" link that opens the LiveImportModal directly on the **edit view** for that specific group (instead of the generic attendees picker).

## How

### 1. Thread `editGroupId` through the modal chain

- **`PreMeetingSetup.tsx`** (line 675-691): Add a "Manage" text link inside the group pill. When clicked, call `onOpenImportModal('attendees', activeGroup.id)` instead of just `onOpenImportModal('attendees')`.
- **`PreMeetingSetup.tsx`** interface: Update `onOpenImportModal` signature to `(tab?: string, editGroupId?: string) => void`.

### 2. Update `LiveImportModal` to accept and forward `editGroupId`

- **`LiveImportModalProps`**: Add `editGroupId?: string`.
- **`LiveImportModal.tsx`**: Pass `editGroupId` down to `MeetingAttendeesTab`.

### 3. Update `MeetingAttendeesTab` to auto-open group edit

- **`MeetingAttendeesTabProps`**: Add `editGroupId?: string`.
- **`MeetingAttendeesTab.tsx`**: Add a `useEffect` — when `editGroupId` is set and groups are loaded, find the matching group, set `editingGroup` to it, and set `groupView` to `'edit'`.

### 4. Wire up in `MeetingRecorder.tsx`

- **`LiveImportModalWithContext`**: Accept and forward `editGroupId`.
- **`MeetingRecorder.tsx`** (line 6686, 6758): Update the `onOpenImportModal` handler to capture and store `editGroupId` in state, pass it to `LiveImportModalWithContext`.

### 5. Update `RecordingFlowOverlay.tsx`

- Update `onOpenImportModal` signature to `(tab?: string, editGroupId?: string) => void`.

## Files to Change

- `src/components/recording-flow/PreMeetingSetup.tsx` — add Manage link in group pill, update callback signature
- `src/components/recording-flow/RecordingFlowOverlay.tsx` — update callback type
- `src/components/MeetingRecorder.tsx` — store editGroupId state, pass through
- `src/components/meeting/import/LiveImportModal.tsx` — accept and forward editGroupId
- `src/components/meeting/import/MeetingAttendeesTab.tsx` — auto-open edit view when editGroupId provided

