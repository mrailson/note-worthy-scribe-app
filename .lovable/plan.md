

## Replace Inline Wait Time Slider with a Compact Popover Icon

Currently the silence threshold (wait time) slider sits inline in the control bar and is hidden on smaller screens (`hidden md:flex`). This change replaces it with a small Clock icon button that opens a popover containing the slider -- saving space and making it accessible on all screen sizes.

### Changes

#### File: `src/components/translation/UnifiedControlBar.tsx`

1. **Add imports** for `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`.

2. **Replace the inline slider block** (lines 198-210, the `hidden md:flex` div with Clock + Slider + label) with a Popover:
   - **Trigger**: A small icon button showing the Clock icon with the current value as a tiny badge/label (e.g. "3s").
   - **Content**: A popover panel containing:
     - A label: "Wait Time"
     - The existing Slider (min 1000, max 5000, step 500) -- note: the current slider uses 0.5-5 range but the state is in milliseconds, so this needs aligning.
     - A description: "Pause before processing speech"
     - The current value displayed as "{X}s"

3. **Fix the slider range mismatch**: The slider currently has `min={0.5} max={5} step={0.5}` but `silenceThreshold` is in milliseconds (e.g. 3000). This needs correcting to `min={1000} max={5000} step={500}` with the display showing `{(silenceThreshold / 1000).toFixed(1)}s`.

4. **Remove the `hidden md:` class** so the popover icon is visible on all screen sizes.

### Technical Detail

The popover approach:
```text
[Clock icon + "3s" label]  <-- compact button, always visible
       |
       v (on click)
  +---------------------------+
  | Wait Time          3.0s   |
  | [========o-----------]    |
  | Pause before processing   |
  +---------------------------+
```

No new files needed. Single file edit to `UnifiedControlBar.tsx`.

