

## Plan: Upgrade Ask AI Document Settings to Match Export Studio

### Summary
Replace the simple popover-based "Document Settings" in the Ask AI `DocumentPreviewModal` with a full modal matching the Meeting Manager's `DocumentSettingsModal` design (NHS blue header, multi-logo grid, etc.), and add two new sections for setting **default Infographic** and **default Slides** preferences that wire through to generation.

### Current State
- **Ask AI** (`DocumentPreviewModal.tsx`): Uses a basic `Popover` with simple switches (Logo on/off, Position dropdown, Footer, PDF Download, Infographic toggle). Uses `useDocumentPreviewPrefs` (localStorage only).
- **Meeting Manager** (`DocumentSettingsModal.tsx`): Full modal with NHS blue header, multi-logo grid with type badges, logo position/size, section toggles, Cancel/Apply buttons. Uses `useUserLogos` + `useUserDocumentSettings` (Supabase-backed).
- Infographic generation in Ask AI currently uses hardcoded `'professional'` style and only accepts orientation at generate time.
- Slides generation in Ask AI is a simple slide-count popover with no image mode or text density options.

### Changes

#### 1. Create `AskAIDocumentSettingsModal` component
**New file**: `src/components/shared/AskAIDocumentSettingsModal.tsx`

Reuse the same visual design as `DocumentSettingsModal` (NHS blue header, card layout, SpecToggle, logo grid from `useUserLogos`). Sections:

- **DISPLAY** (existing): Logo toggle + multi-logo grid + position + size (identical to Export Studio)
- **INFOGRAPHIC DEFAULTS** (new):
  - Default style with thumbnail gallery (8 styles, same as `MeetingExportStudioModal` lines 1098-1141, using `/images/infographic-thumbnails/*.png`)
  - Default orientation toggle (Landscape/Portrait)
  - Logo in infographic toggle
- **SLIDES DEFAULTS** (new):
  - Image mode selector: None / Icons / Web Photos / Illustrations (same 4 options as `SlidesStylePicker` `imageModeOptions`)
  - Text density: Brief / Medium / Detailed (same as `SlidesStylePicker`)
- Footer toggle, PDF Download toggle (existing, moved into this modal)

#### 2. Create persistence hook `useAskAIExportDefaults`
**New file**: `src/hooks/useAskAIExportDefaults.ts`

Store defaults in localStorage (key: `notewell-askai-export-defaults`):
```ts
interface AskAIExportDefaults {
  // Infographic
  defaultInfographicStyle: string; // e.g. 'practice-professional'
  defaultInfographicOrientation: 'landscape' | 'portrait';
  includeLogoInInfographic: boolean;
  // Slides
  defaultImageMode: ImageMode; // 'noImages' | 'pictographic' | 'webFreeToUseCommercially' | 'aiGenerated'
  defaultTextDensity: TextDensity; // 'brief' | 'medium' | 'detailed'
}
```

#### 3. Update `DocumentPreviewModal.tsx`
- Replace the `Popover` "Document Settings" trigger with a button that opens the new `AskAIDocumentSettingsModal`
- Read defaults from `useAskAIExportDefaults`
- Pass the saved default infographic style + orientation to `handleGenerateInfographic` (update the `InfographicSelector` to use defaults or allow override)
- Pass default image mode + text density to the PowerPoint generation flow (update `onExportPowerPoint` callback signature or use a `SlidesStylePicker`-like popover)

#### 4. Wire infographic style through to `useContentInfographic`
- Map the Meeting Manager style keys (e.g. `'practice-professional'`) to the `useContentInfographic` style prompts, or add the Meeting Manager `INFOGRAPHIC_STYLES` prompts to `useContentInfographic`
- Pass the selected style from defaults into `generateInfographic()` options

#### 5. Wire slides defaults through to PowerPoint generation
- Update the Presentation popover in the bottom bar to include the saved image mode and text density as default selections
- Pass these through to `onExportPowerPoint` (which flows to Gamma API)

### Files to Create
1. `src/components/shared/AskAIDocumentSettingsModal.tsx` - New modal component
2. `src/hooks/useAskAIExportDefaults.ts` - New persistence hook

### Files to Modify
1. `src/components/shared/DocumentPreviewModal.tsx` - Replace popover with modal trigger, wire defaults
2. `src/hooks/useContentInfographic.ts` - Add Meeting Manager infographic style prompts

### Design Notes
- The modal will match the Export Studio aesthetic (NHS blue `#003087` header, gold `#FFB81C` accent, same toggle and card styling)
- Infographic thumbnail images already exist at `/images/infographic-thumbnails/{key}.png`
- The approach reuses existing hooks (`useUserLogos`, `useDocumentPreviewPrefs`) and adds a new one for export-specific defaults

