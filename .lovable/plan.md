
# Fix: Stock Image Layout Issues and Increase Pool Variety

## Problem

Three issues are causing inconsistent slide layouts when stock library images are used:

1. **Conflicting image instructions**: Line 203 says "Every slide must include a high-quality photorealistic image" but when stock images are enabled, line 310 sets `imageOptions: { source: 'noImages' }` which disables Gamma's AI image generation. This creates a tug-of-war — Gamma tries to place images on every slide but only has 5 URLs to work with, resulting in oversized images on some slides and empty space on others.

2. **No randomisation**: The query `.limit(5)` with no ordering always returns the same 5 images in database insertion order. Every presentation uses the identical image pool.

3. **Too few images**: Only 5 images are provided to cover 10-15 slides, so Gamma reuses the same images repeatedly or leaves slides bare.

## Solution

All changes are in `supabase/functions/generate-powerpoint-gamma/index.ts`:

### Change 1: Increase stock pool to 30 with random ordering
- Change `.limit(5)` to `.limit(30)` 
- Add `.order('id', { ascending: false })` is insufficient for randomness — instead, use Supabase's random function via `.order('created_at', { ascending: false })` won't randomise either. The proper approach is to fetch a larger pool (e.g. 60) and then shuffle and pick 30 in code using a Fisher-Yates shuffle.

### Change 2: Remove conflicting "every slide" image instruction when stock is active
- Line 203 currently always adds: "Every slide must include a high-quality photorealistic image relevant to the topic. No slide without a visual."
- When `useStockLibraryImages` is true, this instruction should be replaced with a stock-specific instruction: "Use the provided stock library images where relevant. Place images as accent visuals alongside content — never let an image dominate or push text to the bottom. Not every slide needs an image."

### Change 3: Improve image placement instructions
- Update the injected instruction (currently at line 309) to be more explicit about layout: "Place each image as a small accent visual (no wider than 40% of the slide). Content text must remain the primary focus. Never allow an image to push content below the fold."

## Technical Details

| Area | Current | New |
|------|---------|-----|
| Stock pool size | 5 | 30 (from 60 fetched, randomly shuffled) |
| Randomisation | None (same images every time) | Fisher-Yates shuffle in code |
| Image instruction (stock mode) | "Every slide must include image" + "noImages" (conflict) | "Use stock images as accent visuals where relevant" |
| Placement guidance | "Use at most one image per slide" | "Small accent visual, max 40% width, never push text down" |

### Implementation steps

1. Fetch 60 active stock images instead of 5
2. Shuffle the results array using Fisher-Yates and take the first 30
3. Conditionally modify line 203's image instruction based on `useStockLibraryImages`
4. Replace the image injection instruction with stronger layout guidance
5. Redeploy the `generate-powerpoint-gamma` edge function
