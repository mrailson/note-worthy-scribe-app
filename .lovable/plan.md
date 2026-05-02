## Goal

Surface the `LlmModelBadge` and `RegenerateWithSonnetButton` in the meeting notes view so the chunked-by-default architecture is end-to-end usable, then validate against meeting `0bc2717f`.

Both components already exist and are wired to read `notes_model_used` directly from the DB. They just aren't placed in the UI yet.

## Changes

### 1. `src/components/FullPageNotesModal.tsx`

In the `DialogTitle` row (around line 2936–2941), add the badge + refine button to the right-hand side of the title bar so they appear next to the meeting name whenever the notes modal is open.

```text
[Bot icon]  Meeting Title - Meeting Notes        [Claude Sonnet 4.6 · chunked]  [Regenerate with Sonnet]
```

- Import `LlmModelBadge` and `RegenerateWithSonnetButton` from `src/components/meeting-history/`.
- Render them inside the `DialogTitle` flex row, after the truncating title span, with `flex-shrink-0` so they don't get squashed.
- Pass `meetingId={meeting.id}` to both.
- For `RegenerateWithSonnetButton`, pass an `onRefined` callback that re-runs the existing notes refresh (re-fetch `notes_style_3` from the DB — the modal already has a realtime subscription on lines 908–911 plus the `notesUpdated` event handler, so a simple reload of `notes_style_3` is enough).
- The button is self-hiding when `notes_model_used` doesn't include `+chunked-haiku`, so no extra conditional is needed.

### 2. Mobile consideration

On the 402px viewport the title row will be tight. Wrap the right-hand cluster so on mobile the badge sits below the title:

```text
flex items-center gap-2 flex-wrap
```

Keep the title span as `truncate min-w-0`, and the badge/button cluster as `flex-shrink-0 flex items-center gap-2 ml-auto`.

### 3. Validation (after deploy)

1. Open meeting `0bc2717f-35ae-4a43-bd77-8cc0a8fac66e` in the notes modal — confirm the badge reads "Claude Sonnet 4.6 · chunked" (it last regenerated on the chunked path).
2. Click "Regenerate with Sonnet" — confirm:
   - Status flips to `queued` → `generating` (spinner appears).
   - Edge function runs with `forceSingleShot: true`.
   - On completion, `notes_model_used` updates to `claude-sonnet-4-6+refined`, badge re-reads as "Claude Sonnet 4.6 · refined", refine button hides itself.
   - `refine_count` on the meetings row increments.
3. Trigger a fresh auto-generation on a short test meeting (<15k chars transcript) — confirm it skips chunking, badge reads plain "Claude Sonnet 4.6", refine button does NOT appear.

## What's NOT in scope

- No DB migration (the `refine_count` column was added in the previous step).
- No edge function changes — `auto-generate-meeting-notes` already handles `forceSingleShot` and the `+refined` stamp.
- No changes to `MobileNotesSheet` / `SafeModeNotesModal` in this pass — we'll add the same badge there in a follow-up only if you want the refine flow available on the mobile sheet too.

## Files touched

- `src/components/FullPageNotesModal.tsx` (header row only)
