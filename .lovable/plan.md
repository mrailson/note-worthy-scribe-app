

# Fix Gamma PowerPoint Font Warning

## Problem
The Gamma API defaults to the "Inter" font family (Inter Light, Inter Bold) when generating PPTX files. Since Inter is not a standard Windows/Office font, PowerPoint displays a "Save with Fonts" warning dialog the first time the user saves the file.

## Solution
Always include an explicit font instruction in the `additionalInstructions` sent to the Gamma API, defaulting to "Calibri" (which is the standard Office font and matches the local PPTX generation). This ensures Gamma uses universally available fonts regardless of whether the user selects a font style.

## File to Modify

**`supabase/functions/generate-powerpoint-gamma/index.ts`** (lines 222-230)

Currently, font instructions are only added when `fontStyle` is provided:

```typescript
if (fontStyle) {
  const fontMap = { ... };
  additionalInstructions += ` ${fontMap[fontStyle] || 'Professional fonts'}.`;
}
```

Change to always include a font directive:

```typescript
const fontMap = {
  'professional': 'Use Calibri or Arial fonts only',
  'modern': 'Use Calibri or Segoe UI fonts only',
  'elegant': 'Use Georgia or Cambria serif fonts only',
  'clean': 'Use Arial or Calibri fonts only',
};
const fontInstruction = fontMap[fontStyle] || 'Use Calibri or Arial fonts only — do not use Inter or any non-standard fonts';
additionalInstructions += ` FONTS: ${fontInstruction}.`;
```

This ensures:
- Every generated PPTX uses standard Office-compatible fonts
- The existing font style options still work as expected
- The "Inter" font is explicitly excluded in the default case
- No visual quality is lost since Calibri and Arial render beautifully in PowerPoint

## Why This Works
Gamma respects the `additionalInstructions` field for styling. By explicitly requesting standard fonts and prohibiting Inter, the generated PPTX will only reference fonts already installed on Windows/macOS, eliminating the "Save with Fonts" dialog entirely.

