
# Auto-Save Generated Images & Improved Gallery Viewing

## Overview
Two changes: (1) automatically save every generated image to the gallery without requiring users to click "Save to Gallery", and (2) replace the current zoomed-in grid view in the gallery with a slideshow/carousel view option.

---

## 1. Auto-Save Images to Gallery on Generation

**Current behaviour**: After generating an image in Image Studio, users must manually click "Save to Gallery". The same applies to quick edits in the Edit panel.

**Change**: Automatically call `saveToGallery()` immediately after a successful generation, so every image is saved without user action.

### Files to modify:

**`src/hooks/useImageStudio.ts`** (around lines 428-450)
- After the `result` is returned from `attemptGeneration()` and added to history, call `saveToGallery(result)` automatically.
- The save runs in the background (fire-and-forget) so it doesn't block the UI.
- Remove the need for the manual "Save to Gallery" button trigger.

**`src/components/ai4gp/studio/GenerateTab.tsx`**
- Remove or repurpose the "Save to Gallery" button. Replace it with a subtle "Saved to Gallery" indicator (auto-shown) so users know it was saved.
- The button can become a static "Saved" badge with a tick icon after generation.

**`src/components/ai4gp/studio/EditImagePanel.tsx`**
- Similarly auto-save after a successful quick edit result, removing the manual save step.

---

## 2. Gallery View Improvements - Add Slideshow/Carousel View

**Current behaviour**: The gallery uses a grid of square cards with `object-cover`, which crops images. The lightbox exists but requires double-clicking.

**Changes**:

### A. Fix the grid thumbnails (quick win)
- Change `object-cover` to `object-contain` on the grid image thumbnails in `ImageGalleryModal.tsx` (line 689) so images aren't cropped/zoomed.
- Add a subtle background colour so images with transparent areas still look clean.

### B. Add a Slideshow/Carousel view toggle
- Add a view mode toggle (Grid / Slideshow) in the gallery toolbar area.
- **Grid view**: The existing grid layout (with the object-contain fix).
- **Slideshow view**: A carousel-style view using the existing Embla carousel component (`src/components/ui/carousel.tsx`). Shows one image at a time with:
  - Previous/Next navigation arrows
  - Image title and metadata below
  - Keyboard navigation (arrow keys)
  - Image counter ("3 of 12")
  - Smooth transitions between images

### Files to modify:

**`src/components/ai4gp/ImageGalleryModal.tsx`**
- Add a `viewMode` state: `'grid' | 'slideshow'`
- Add toggle buttons (Grid icon / Play icon) near the search bar
- When `viewMode === 'slideshow'`, render a new `ImageSlideshowView` component instead of the `ImageGrid`
- Fix `object-cover` to `object-contain` in `ImageGrid`

**`src/components/ai4gp/ImageSlideshowView.tsx`** (new file)
- Uses `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext` from the existing carousel component
- Each slide shows the image with `object-contain` at a good size
- Displays title, date, source, and favourite status below
- Supports clicking to select the image (populates the details panel)
- Keyboard arrow key navigation via the Embla carousel

---

## Technical Notes
- Auto-save uses the existing `saveToGallery` function which inserts into `user_generated_images` table
- The carousel uses the already-installed `embla-carousel-react` package
- No new dependencies required
- Auto-save is idempotent-safe: each generation creates a unique row with a new timestamp
