

## Add Zoom/Scale Slider to the Glass Map Modal

### Problem
The map only fills roughly half the screen on some displays because the map content itself doesn't scale to fill the available viewport space.

### Solution
Add a zoom slider control inside the map modal that lets users scale the map content up or down (e.g. 50%--150%) to best fit their screen resolution.

### Technical Details

**File: `src/components/sda/SDAExecutiveSummary.tsx`**

1. Add a `mapZoom` state variable (default: `100`, range `50`--`150`).
2. Inside the `Dialog` for the Glass Map, add a floating zoom slider bar at the bottom-centre of the modal:
   - A small horizontal `Slider` component (already available in the project) with minus/plus icons either side.
   - Shows the current zoom percentage.
   - Styled with a semi-transparent dark background to match the navy glass aesthetic.
3. Wrap `<NRESGlassMap />` in a container with `transform: scale()` driven by `mapZoom / 100`, using `transform-origin: top center` so the map scales from the top.
4. The slider control will sit in a fixed position overlay at the bottom of the modal so it remains accessible regardless of scroll position.

**Approximate layout of the zoom bar:**

```text
  [ - ]  ======|======  [ + ]   85%
```

No other files need changing. The existing `Slider` UI component and `lucide-react` icons (`ZoomIn`, `ZoomOut`) will be reused.

