
## Fix: Android (and all mobile) devices showing old meeting notes view

### Problem
When viewing meeting notes on Android (or any mobile device), users see the **old** `MobileNotesSheet` component — a simpler sheet that lacks newer features like green speech highlighting and the updated layout. iPhone and desktop users see the full-featured modal because of different code paths or specific navigation flows.

The root cause is in `MeetingHistoryList.tsx`, line 714:

```text
if (isMobile) {
  -> Opens MobileNotesSheet (old, limited)
} else {
  -> Opens FullPageNotesModal (new, full-featured)
}
```

The `FullPageNotesModal` already has responsive mobile styling built in (full-screen on mobile with `w-full h-full max-w-none` classes), so there is no need for a separate mobile component.

### Solution
Update the `handleViewNotes` function to always open the `FullPageNotesModal` regardless of device type, removing the mobile/desktop branching that routes Android and other mobile users to the old sheet.

### Changes

**1. `src/components/MeetingHistoryList.tsx`**
- In `handleViewNotes` (around line 714), remove the `if (isMobile)` branch so it always opens `desktopNotesOpen` (which renders the `FullPageNotesModal`)
- Update the rendering section (around line 3170) to remove the `!isMobile &&` guard on `FullPageNotesModal`, so it renders on all devices
- Keep the `MobileNotesSheet` import and component in place for now (to avoid breaking any other references), but it will no longer be triggered from the main notes flow

### Technical Detail
The `FullPageNotesModal` already handles mobile responsiveness:
```text
className={`${isMobile
  ? "w-full h-full max-w-none max-h-none inset-0 m-0 rounded-none border-0" 
  : "w-[86.4rem] max-w-[95vw] h-[90vh] max-h-screen"
}`}
```

This means Android users will immediately get the same full-featured experience (green speech, tabs, export options) that browser and iPhone users see.
