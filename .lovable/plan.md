## Problem

On the affected slide (slide 5, "Your Next Steps After This Session"), the AI-generated image of the NHS reception fills the top ~60% of the slide. The title, four content cards and the green callout are then crammed into the bottom third, forcing Gamma to shrink body text far below the 16pt floor. Other slides in the same deck look fine because they use smaller header images.

The cause is in the prompt sent to Gamma in `supabase/functions/generate-powerpoint-gamma/index.ts`:

- **AI-generated images** (line ~295-296): instruction says illustrations should be *"prominent and visually engaging"* with no size constraint.
- **Stock images** (line ~298-299): already has a guard *"Place images as accent visuals alongside content — never let an image dominate or push text to the bottom"* — which is why the stock-image path doesn't show this bug.

The AI-image path simply needs the same guardrail.

## Fix

Edit `supabase/functions/generate-powerpoint-gamma/index.ts` only — single prompt change, no client/UI work.

1. **Constrain AI-image size and placement** in the `aiGenerated` branch (~line 295-296):
   - Replace *"Illustrations should be prominent and visually engaging"* with explicit limits:
     - Image must occupy **no more than 40% of slide area**.
     - Place as an **accent visual on one side** (left or right column), never full-width or full-height.
     - **Never push title or body text below the visible area** — content text remains the primary focus.
     - If a slide has 3+ content blocks (cards, bullets, steps), the image must be smaller (≤ 30%) or omitted on that slide.

2. **Add a global layout-consistency rule** to `additionalInstructions` (just before the LAYOUT line at ~316):
   - *"All slides in the deck must use a consistent layout pattern. Do not let any single slide deviate to a hero-image layout that shrinks body text below the 16pt minimum."*

3. **Strengthen the existing LAYOUT line** (~line 316):
   - Add: *"If content does not fit at the minimum text sizes, split into an additional slide rather than shrinking text or compressing the layout."*

These are prompt-only changes — no schema, no edge-function signature changes, no client changes. Existing slides that already render well will continue to do so; only Gamma's tendency to produce occasional hero-image layouts is suppressed.

## Verification

After deploy, regenerate the same PLT Session Plan deck with **Illustrations** mode selected and confirm slide 5 (and any equivalent multi-card slides) renders with:
- Image ≤ 40% of slide area, placed as a side accent
- All four content cards readable at normal body size
- Consistent layout with the rest of the deck
