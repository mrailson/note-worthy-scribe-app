

## Add "Mobile Live" / "Mobile Offline" Recording Source to Badge

### Problem
The `RecordingDeviceBadge` currently shows Chrome, Edge, iPhone, etc. based on device info. But:
1. Mobile recordings never call `attachDeviceInfoToMeeting`, so they often have no device data at all
2. The recording mode (Live vs Offline) is never persisted, so there's no way to distinguish them

### Plan

#### Step 1: Persist recording mode in `import_source` field
The `import_source` column already exists on the `meetings` table. Mobile recordings currently set it to `"mobile_recorder"`. Change this to be more specific:
- **Live mode**: `"mobile_live"`
- **Offline mode**: `"mobile_offline"`

Update all meeting insert calls in `NoteWellRecorderMobile.jsx` (there are ~4 insert locations around lines 816, 1014, 1039, 1212) to pass the current `mode` variable into `import_source`.

Also call `attachDeviceInfoToMeeting` after each successful mobile meeting insert so device_browser/device_os/device_type are populated too.

#### Step 2: Update `RecordingDeviceBadge` to show recording mode
Modify `src/components/meeting-history/RecordingDeviceBadge.tsx`:
- Add `import_source` to the query (`select`)
- Update `getDeviceLabel` logic:
  - `import_source === "mobile_live"` → **"Mobile · Live"**
  - `import_source === "mobile_offline"` → **"Mobile · Offline"**
  - `import_source === "mobile_recorder"` (legacy) → **"Mobile"** (keeps backward compat)
  - Existing Chrome/Edge/Safari labels remain unchanged
- Add distinct badge colours for the two mobile modes (e.g. blue for live, amber for offline)
- Use `Smartphone` icon for both mobile modes

#### Files to edit
- `src/components/recorder/NoteWellRecorderMobile.jsx` — pass mode into import_source + call attachDeviceInfoToMeeting
- `src/components/meeting-history/RecordingDeviceBadge.tsx` — read import_source, add mobile mode labels/colours

