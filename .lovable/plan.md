

## Improve Meeting Minutes Layout in Document Preview

**Goal**: Enhance the `renderPreviewContent` function in `DocumentPreviewModal.tsx` to display meeting header details (date, time, location, attendees, apologies) in a structured two-column table, and improve the formatting of numbered agenda items with better visual hierarchy.

### Changes — `src/components/shared/DocumentPreviewModal.tsx`

**1. Auto-detect and render meeting details as a table (lines ~145-210)**

Add a new detection pass at the start of the rendering loop that identifies "key: value" lines commonly found in meeting minutes headers. Lines matching patterns like `Date:`, `Time:`, `Location:`, `Meeting Title:`, `Attendees:`, `Apologies:`, `Chair:` will be collected into a structured two-column table with a blue header row and alternating styling.

The logic:
- Scan lines until a numbered item (e.g. `1.`) or a heading is hit
- Collect any `Label: Value` pairs found in that preamble
- Render them as a bordered table with the label in bold in column 1 and value in column 2
- Multi-line values (e.g. attendee lists) are grouped under their parent label

**2. Improve numbered agenda item formatting (lines ~194-200)**

Currently only ALL-CAPS numbered headings are detected (e.g. `1. PURPOSE`). Expand this to also match mixed-case numbered items like `1. Welcome, Apologies and Declarations of Interest` and render them as styled section headings with:
- A subtle left border accent (primary blue)
- Slightly larger font weight
- Clear spacing above/below

**3. Add separator between meeting details table and agenda content**

Insert a thin horizontal divider after the header table to visually separate metadata from the meeting body.

### Visual Result

Before:
```text
Oak Lane Medical Practice
Partnership Meeting Minutes
11 March 2026
Meeting Title: Partnership Meeting
Date: 5 March 2026
Time: 13:00 – 15:45
Location: Partners' Meeting Room
Attendees:
Dr Helen Ashworth (Senior Partner, Chair)
...
1. Welcome, Apologies and Declarations of Interest
```

After:
```text
┌──────────────────┬──────────────────────────────┐
│ Meeting Title    │ Partnership Meeting          │
│ Date             │ 5 March 2026                 │
│ Time             │ 13:00 – 15:45               │
│ Location         │ Partners' Meeting Room       │
│ Attendees        │ Dr Helen Ashworth, Dr Raj... │
│ Apologies        │ Dr Fiona Clarke              │
└──────────────────┴──────────────────────────────┘

━━ 1. Welcome, Apologies and Declarations of Interest ━━
  Dr Ashworth opened the meeting and noted apologies...

━━ 2. Minutes of the Previous Meeting ━━
  Dr Patel requested a correction to Item 4...
```

### Technical Detail

All changes are in a single file: `src/components/shared/DocumentPreviewModal.tsx`, specifically the `renderPreviewContent` function (lines 65-213). The approach:

1. First pass: scan lines for `key: value` metadata patterns before the first numbered item or heading, collect into a `metadataRows` array, track which lines were consumed.
2. Render metadata as a styled `<table>` with NHS blue header background.
3. For remaining lines, expand the numbered heading regex from `/^(\d+)\.\s+([A-Z][A-Z\s]+)$/` to `/^(\d+)\.\s+(.+)$/` and render with a left-border accent style.
4. The practice name and document title lines at the very top (before the metadata table) remain as styled headings.

