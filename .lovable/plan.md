

## Add Silent Progress Bar for PowerPoint Generation in DocumentPreviewModal

**Goal**: Show a progress banner (identical to the infographic one) inside the DocumentPreviewModal when PowerPoint is generating, so users can continue reading the document while waiting.

### Changes

**1. `src/components/shared/DocumentPreviewModal.tsx`**
- Add an optional `isPowerPointGenerating?: boolean` prop to `DocumentPreviewModalProps`
- Add a PowerPoint progress banner (mirroring the infographic one at lines 726-742) with a `Presentation` icon, animated progress bar, and rotating tips
- Place it just below (or alongside) the infographic banner, before the document content area
- Use a simulated progress bar (like infographic does) with rotating tip messages such as "Preparing slides...", "Formatting content...", "Applying theme...", "Building presentation..."

**2. `src/components/DocumentStudio/StepGenerate.tsx`**
- Destructure `isGenerating` from `useGammaPowerPoint()` (already available)
- Pass `isPowerPointGenerating={isGenerating}` to `DocumentPreviewModal`

**3. `src/components/DocumentStudio/MyDocuments.tsx`**
- Destructure `isGenerating` from `useGammaPowerPoint()` (already available)
- Pass `isPowerPointGenerating={isGenerating}` to `DocumentPreviewModal`

**4. `src/components/AI4GPService.tsx`**
- Pass `isPowerPointGenerating={isPowerPointGenerating || isFullPowerPointGenerating}` where `DocumentPreviewModal` is rendered (via `MessageRenderer` → would need prop threading, or alternatively pass directly if DocumentPreviewModal is used here)

Since `AI4GPService` uses `DocumentPreviewModal` indirectly through `MessageRenderer`, and the main use case from the screenshot is Document Management, the priority is `StepGenerate` and `MyDocuments`. The `AI4GPService` context already has its own `PowerPointGenerationOverlay` dialog.

### Visual Result
A banner appears above the document (same position as infographic banner) showing:
```
[📊 icon]  Creating Presentation...
[============================--------]  (progress bar)
Formatting slides and applying theme...  (rotating tip)
```

The user can continue reading the document content below while this runs silently.

