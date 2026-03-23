

## Plan: Clickable Attendees Preview Panel

### What
Make the "Present" pill (👥) clickable when attendees are loaded. Clicking opens a glass-panel dropdown (matching the transcript/word count panel style) showing all attendees grouped by status: Present, Apologies, and Absent — each clearly identified with color-coded badges.

### Implementation

**1. Update `ContextStatusPill.tsx` — add optional `onClick`**
- Add `onClick?: () => void` to the props interface
- When provided, render as a `<button>` instead of `<div>` with `cursor: pointer`

**2. Create `AttendeePreviewPanel.tsx`**
- Glass panel component matching `LiveTranscriptGlassPanel` styling (blur backdrop, rounded-16, shadow, absolute positioning)
- Props: `open`, `onClose`, `attendees` (from context)
- Layout:
  - Header: "👥 Attendees" with total count
  - Three sections with colored headers: **Present** (green), **Apologies** (amber), **Absent** (slate)
  - Each attendee row: avatar circle (initials) + name + role + org
  - Sections only shown when they have members
  - Click-outside to close

**3. Update `LiveContextStatusBar.tsx`**
- Add `attendeePreviewOpen` state
- Pass `onClick` to the Present pill (when `presentCount > 0` or any attendees exist)
- Also make the Agenda pill clickable (as previously planned) with its own `agendaPreviewOpen` state and inline panel
- Render `AttendeePreviewPanel` anchored below the pill
- Wrap the Present pill in a `position: relative` container

### Visual Design
- Present attendees: green left-border accent, green status dot
- Apologies: amber left-border accent, amber "Apologies" badge
- Absent: slate/grey left-border accent, grey "Absent" badge
- Each row shows: initials avatar → name (bold) → role (muted) → org (muted smaller)
- Panel width ~340px, max-height with scroll

