

## Problem

The Overview tab on mobile has two layout issues visible in the screenshots:

1. **Overview text is a wall of text** -- the `overview` field contains inline bullet markers (•) that render as a continuous paragraph, making it very hard to read on a small screen.
2. **Key Points duplicates and truncates** -- `overviewBullets` is derived by splitting the same overview text on `•`, `\n`, and `-`, which produces fragments that start mid-sentence (e.g. "based reporting and same") because the split cuts through the executive summary paragraph.

## Plan

### 1. Smarter overview parsing (MobileMeetingDetail.tsx)

Replace the current naive split with a two-part parser:
- **Summary paragraph**: Extract the text before the first bullet marker (`•` or `\n-`). Display this as a readable paragraph in its own card.
- **Key points list**: Extract everything after the first bullet marker as discrete bullet items. Filter out fragments shorter than ~20 chars to avoid the "based reporting and same" problem.

This eliminates the duplication (showing the same text twice) and the mid-sentence truncation.

### 2. Improve spacing and readability (mobile-meetings.css + component)

- Add `margin-bottom: 16px` between the summary card and the key points card.
- Increase `nw-mh-overview-text` font-size slightly to 15px for better readability on mobile.
- Add `padding: 12px 0` on bullet items (up from 10px) for more breathing room.
- Give the "KEY POINTS" section title proper top margin (`marginTop: 24px`).

### 3. Files changed

- `src/components/mobile-meetings/MobileMeetingDetail.tsx` -- rewrite `overviewBullets` memo and overview rendering block
- `src/components/mobile-meetings/mobile-meetings.css` -- minor spacing tweaks

