## Change

In `src/pages/NRESTimeTracker.tsx` (lines ~827–871), swap the single-line `<Input>` for the existing `<Textarea>` so dictated words append visibly instead of scrolling out to the left.

### Edits

1. Replace `<Input>` with `<Textarea>` (already imported at line 11):
   - `rows={2}`, `className="pr-9 resize-none overflow-y-auto max-h-40"`
   - `onChange`: keep existing `setNotes` + `notesBaseRef` sync, then auto-grow:
     ```
     const el = e.currentTarget;
     el.style.height = 'auto';
     el.style.height = Math.min(el.scrollHeight, 160) + 'px';
     el.scrollTop = el.scrollHeight;
     ```
2. Hold a `notesElRef = useRef<HTMLTextAreaElement>(null)` and pass to the Textarea. In `startMic`'s `onPartial`/`onFinal` handlers, after `setNotes(...)`, schedule `requestAnimationFrame(() => { const el = notesElRef.current; if (el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; el.scrollTop=el.scrollHeight; } })` — this is the polish that keeps the caret/view glued to the bottom as new dictated words land.
3. Move the mic button anchor from vertical-centre to top-right so it stays put as the textarea grows: change `top-1/2 -translate-y-1/2` → `top-1.5` (drop the translate).
4. Keep `onPaste` screenshot logic, placeholder, and all `startMic`/`stopMic`/`BrowserSpeechRecognition` wiring exactly as-is.

### Files touched

- `src/pages/NRESTimeTracker.tsx` only. No new imports, no dependencies, no edge-function changes.
