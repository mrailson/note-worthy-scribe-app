

## Smartphone Recording Hub - Tabbed Modal

### Overview
Replace the separate Smartphone QR icon (`QuickRecordQRLink`) and the inline Info icon (`RecordingSetupGuide`) with a single **Smartphone icon** in the recorder controls row. Clicking it opens a tabbed dialog with three tabs:

1. **Record via Phone** (default) - QR code to record on smartphone (requires internet)
2. **Offline Guide** - iPhone offline recording instructions (existing guide content)
3. **Import Audio** - File upload and transcription facility (reuses existing `CreateMeetingTab` logic)

### What Changes

**1. New component: `src/components/meeting/SmartphoneRecordingHub.tsx`**
- Single `Smartphone` icon button with tooltip "Use Smartphone / Import Audio"
- Opens a `Dialog` containing `Tabs` with three tabs
- **Tab 1 - "Record via Phone"**: Migrates QR code logic from `QuickRecordQRLink` (token fetch, QR generation, display). Shows a note that internet is required. Icon: `QrCode`
- **Tab 2 - "Offline Guide"**: Migrates the step-by-step guide content from `RecordingSetupGuide` (all 5 steps with icons). Icon: `WifiOff`
- **Tab 3 - "Import Audio"**: Embeds the existing `CreateMeetingTab` component (file drag-drop, audio transcription, meeting creation). Icon: `Upload`
- On mobile/smartphone devices, the QR tab is hidden (user is already on phone) and defaults to the Offline Guide tab instead

**2. Modify `src/components/MeetingRecorder.tsx`**
- Remove `QuickRecordQRLink` import and usage from the controls row (line ~6410)
- Remove `RecordingSetupGuide` import and usage from the tab trigger (line ~6326)
- Remove the separate Upload/Import icon button (lines ~6411-6426)
- Add `SmartphoneRecordingHub` in the controls row where the smartphone icon currently sits
- Keep the `LiveImportModal` for the existing attendees/agenda import (that's a different feature)

**3. Remove standalone components** (no longer needed as separate files)
- `src/components/meeting/QuickRecordQRLink.tsx` - logic absorbed into hub
- `src/components/meeting/RecordingSetupGuide.tsx` - content absorbed into hub

### Technical Details

- The hub component will manage its own state for QR token fetching (reusing the same Supabase query from `QuickRecordQRLink`)
- The `CreateMeetingTab` already accepts `onComplete` and `onClose` props, so it integrates cleanly as a tab panel
- The dialog uses `max-w-lg` to accommodate all three tab contents comfortably
- Tab icons use `QrCode`, `WifiOff`, and `Upload` from lucide-react for visual clarity
- The smartphone detection logic from `QuickRecordQRLink` is preserved to auto-select the appropriate default tab

