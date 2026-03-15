

## Plan: Redesign Export Studio Bottom Bar + Integrate Audio Studio + Expand Document Settings

### Overview
Replace the current bottom export bar in `MeetingExportStudioModal.tsx` with a 4-button tab grid (Word, Slides, Infographic, Audio Studio) with contextual action panels. Remove the standalone "Generate Audio Summary" (Headphones) icon from the SafeModeNotesModal toolbar. Expand the Document Settings modal content (already has logo manager and section toggles — mostly in place).

### Changes

#### 1. Remove "Generate Audio Summary" toolbar icon (`SafeModeNotesModal.tsx`)
- **Lines 3164-3177**: Delete the Quick Audio Summary tooltip/button block (Headphones icon that opens `setShowQuickAudioModal(true)`)
- Keep the Audio Studio (Mic) button and the QuickAudioSummaryModal component — just remove the toolbar shortcut

#### 2. Redesign bottom export bar (`MeetingExportStudioModal.tsx`)
Replace lines 776-827 (the current bottom bar with Word/Presentation/Infographic/Cancel buttons) with:

- **State**: Add `selectedExport` state: `'word' | 'slides' | 'infographic' | 'audio'`, default `'word'`
- **4-column button grid**: Equal-width buttons with icon + label + subtitle
  - Word (FileText icon, subtitle "Download")
  - Slides (Presentation icon, subtitle "PowerPoint")  
  - Infographic (BarChart3/LayoutGrid icon, subtitle "Visual summary")
  - Audio Studio (Headphones icon, subtitle "Discussion")
  - Active: `bg-[#003087] text-white`, Inactive: `bg-white border-[0.5px] border-[#e5e7eb]`
- **Action panel** below buttons: `bg-[#f9fafb] border-[0.5px] border-[#e5e7eb] rounded-lg p-[10px_12px]`
  - Shows title, description, and action button based on `selectedExport`
  - Word → calls `handleDownloadWord`
  - Slides → opens slide count popover then `handlePptGenerate`
  - Infographic → opens orientation choice then `handleGenerateInfographic`
  - Audio Studio → toggles `showAudioStudio` (opens existing Audio Studio in parent)
- **Cancel** text button below action panel

- Need to pass `onOpenAudioStudio` callback from `SafeModeNotesModal` into `MeetingExportStudioModal` so the Audio Studio button can open the existing panel

#### 3. Document Settings already complete
The `DocumentSettingsModal.tsx` already contains the multi-logo manager, section toggles with subtitles, and preview strip — all matching the requested specs. No changes needed here.

#### 4. Pass section toggles to generation functions
- **Word**: Already done (lines 441-455 in MeetingExportStudioModal)
- **PowerPoint**: Pass `docSettings` section toggles to `MeetingPowerPointModal` as a prop, filter content before generation
- **Infographic**: Pass section toggle states to `generateInfographic` call, filter excluded sections from content

### Files Modified
1. **`src/components/SafeModeNotesModal.tsx`** — Remove Headphones toolbar button (lines 3164-3177), add `onOpenAudioStudio` prop to MeetingExportStudioModal usage
2. **`src/components/meeting-details/MeetingExportStudioModal.tsx`** — Replace bottom bar with 4-tab grid + action panel, add `onOpenAudioStudio` prop, pass section toggles to PPT/infographic

