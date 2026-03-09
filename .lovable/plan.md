

## Plan: Add PowerPoint Export to Document Preview Modal

### What
Add a "Create Presentation" button with slide count selection (5–12) to the `DocumentPreviewModal` bottom action bar, alongside the existing Word, PDF, and Infographic buttons.

### Changes

**1. `DocumentPreviewModal.tsx` — Add props and PowerPoint UI**
- Add new optional props: `onExportPowerPoint?: (content: string, title?: string, slideCount?: number) => void`
- Add state for slide count selection (using a small dropdown/popover)
- In the bottom actions bar (line ~680), after the PDF button and before the infographic separator, add a `Popover` containing slide count options (5–12) that triggers `onExportPowerPoint(activeContent, documentTitle, selectedCount)`
- Import `Presentation` icon from lucide-react

**2. `MessageRenderer.tsx` — Pass PowerPoint handler to DocumentPreviewModal**
- Pass `onExportPowerPoint` prop to `<DocumentPreviewModal>` at line ~1621, wiring it to the existing `onExportPowerPoint` callback (which calls up to `AI4GPService`)

**3. `AI4GPService.tsx` — No changes needed**
- The existing `handleExportPowerPoint` function already accepts `(content, title, slideCount)` and calls `generateWithGamma`

**4. Other consumers** (`AIResponsePanel.tsx`, `StepGenerate.tsx`, `MyDocuments.tsx`)
- These can optionally receive the prop too, but since the user's screenshot shows the Ask AI context, `MessageRenderer.tsx` is the priority. The others will simply not pass the prop and the button won't render (guarded by `onExportPowerPoint &&`).

### UI Design
- A `Popover` trigger button labelled "Presentation" with a slides icon, placed after PDF in the bottom bar
- Popover content: a compact list of slide counts 5–12, each clickable to trigger generation
- Consistent with the existing dropdown sub-menu pattern from the message-level export

