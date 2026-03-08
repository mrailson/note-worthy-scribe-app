

## Document Preview Modal — Fixes and Infographic Integration

### Problems Identified

1. **Scrolling broken**: The `ScrollArea` (Radix) inside the fixed-height `DialogContent` (`max-h-[92vh]`) isn't scrolling because the inner content overflows without proper height constraints. The `flex-1 min-h-0` pattern requires explicit height propagation that Radix ScrollArea sometimes doesn't respect.

2. **`####` and `---` rendering as raw text**: The `renderPreviewContent` function only handles `#`, `##`, `###` headings. Lines starting with `####` fall through to the paragraph renderer and display literally. Similarly, `---` horizontal rules are treated as bullet-point triggers (the regex `^[-•*]\s+` doesn't match `---`, but `---` without a space just becomes a paragraph showing `---`).

3. **No infographic option in the modal**: Currently, infographics are only accessible from the message dropdown menu. The user wants Landscape and Portrait infographic buttons inside the DocumentPreviewModal itself, which silently trigger generation and display the result inline.

---

### Plan

#### File: `src/components/shared/DocumentPreviewModal.tsx`

**Fix 1 — Scrolling**
- Replace `<ScrollArea>` with a plain `<div>` using `overflow-y-auto flex-1 min-h-0` — this avoids the Radix ScrollArea height calculation issue inside flex containers.

**Fix 2 — Markdown parsing gaps**
In `renderPreviewContent`:
- Add `####` heading support (render as `<h4>` styled similarly to `<h3>` but slightly smaller).
- Add `---` / `***` / `___` horizontal rule detection — skip these lines entirely (don't render them) since the user doesn't want separators.
- Ensure the heading detection order goes `####` → `###` → `##` → `#` (most specific first).

**Fix 3 — Infographic generation inside the modal**
- Add new props: `imageGenerationModel`, `practiceName`, `spellingCorrections` (passed from `MessageRenderer`).
- Add state: `infographicMode` (`null | 'generating' | 'landscape' | 'portrait'`), `infographicUrl`, `infographicError`, `infographicProgress`.
- Add two buttons in the bottom action bar: "Infographic (Landscape)" and "Infographic (Portrait)" with the `ImageIcon` and `Monitor`/`FileText` icons.
- When clicked: set `infographicMode`, call `useContentInfographic().generateInfographic()` silently, show a progress indicator overlaying the preview area.
- On completion: replace the document preview with the generated infographic image displayed at full width inside the preview area. Show download button for the image.
- On error: show error message with retry option.
- Add a "Back to Document" button to return to the text preview.

#### File: `src/components/MessageRenderer.tsx`

- Pass `imageGenerationModel`, `infographicPracticeName`, and `infographicSpellingCorrections` to `DocumentPreviewModal` so it can trigger infographic generation.

---

### Technical Detail

**Heading order fix** (line ~146 area):
```
if (trimmed.startsWith('#### ')) → <h4> styled
if (trimmed.startsWith('### '))  → <h3> (existing)
if (trimmed.startsWith('## '))   → <h2> (existing)  
if (trimmed.startsWith('# '))    → <h1> (existing)
```

**HR detection** (before bullet check):
```
if (/^[-*_]{3,}$/.test(trimmed)) → skip (continue)
```
This must come before the bullet regex `^[-•*]\s+` to prevent `---` being mishandled.

**Scrolling fix**:
Replace line 334's `<ScrollArea className="flex-1 min-h-0 ...">` with `<div className="flex-1 min-h-0 overflow-y-auto ...">` and remove the closing `</ScrollArea>`.

**Infographic in modal** — reuses `useContentInfographic` hook directly (same as `ContentInfographicModal` does). Progress UI shown inline in the preview area with the same rotating tips pattern.

### Files to Modify
1. `src/components/shared/DocumentPreviewModal.tsx` — all three fixes
2. `src/components/MessageRenderer.tsx` — pass additional props to DocumentPreviewModal

