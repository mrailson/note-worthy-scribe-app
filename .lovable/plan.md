

# Fix: Policy Word Document Alignment Issues

## Problem
The on-screen policy preview renders correctly, but the downloaded Word document has content "going out of line" because the markdown-to-docx parser handles several patterns differently from (or worse than) the HTML preview parser.

## Root Causes and Fixes

### 1. Numbered section headings treated as indented list items
**Issue:** Lines like `1. PURPOSE AND SCOPE` (all-caps numbered headings) are caught by the generic numbered-list regex and rendered as indented body text with a left margin, rather than as bold section headings.

**Fix:** In `parseMarkdownToSections`, add a check before the numbered-list handler: if the text after the number is all uppercase (matching the preview's `numberedHeadingMatch` pattern), render it as a Heading 1 with no indent, matching the preview's treatment.

### 2. Sub-numbered headings (e.g. "1.1 Purpose") not recognised
**Issue:** The preview renders `1.1 Purpose` as a distinct sub-heading (`h3`), but the Word parser has no such pattern. These lines fall through to regular paragraph text, losing visual hierarchy.

**Fix:** Add a sub-numbered heading pattern (`/^\d+\.\d+\s+(.+)$/`) in `parseMarkdownToSections`, placed before the numbered-list check. Render these as bold paragraphs with `subHeadingBlue` colour and appropriate spacing, matching the preview's `h3` styling.

### 3. Nested/indented bullet points lose alignment
**Issue:** Sub-bullets (lines starting with two or more spaces before `- ` or `* `) are not recognised as bullets. They render as regular paragraphs at the left margin, breaking the list structure.

**Fix:** Extend the bullet-point detection to handle indented bullets. Calculate the indent level from leading whitespace and apply proportionally larger `indent.left` values (e.g. 0.5 inch for second level, 0.75 inch for third level). Use a different bullet character (e.g. `◦` or `–`) for sub-levels to distinguish from top-level bullets.

### 4. Table detection too aggressive
**Issue:** The Word parser triggers table mode for any line containing `|` if the next line contains `---`, even when the line doesn't start and end with `|`. This can capture non-table content.

**Fix:** Tighten the table-start condition to require the line starts with `|`, matching the preview's stricter check.

### 5. Heading 4+ patterns (####) not handled
**Issue:** If AI-generated content includes `#### ` headings, these fall through to regular paragraph text in the Word export, but display as plain bold in the preview.

**Fix:** Add `#### ` handling in `parseMarkdownToSections` -- render as a bold paragraph with standard text size and grey colour, consistent with the `### ` styling but slightly less prominent.

## File Changes

### `src/utils/generatePolicyDocx.ts`

All changes are within the `parseMarkdownToSections` function (lines 601-806):

| Line Range | Change |
|---|---|
| ~765-794 | Add numbered heading detection (all-caps check) before the existing numbered-list handler |
| ~765 (new) | Add sub-numbered heading pattern (e.g. `1.1`, `2.3.1`) with appropriate styling |
| ~767-778 | Extend bullet detection to handle indented sub-bullets with deeper indent values |
| ~680 | Tighten table-start condition to require line starts with `\|` |
| ~748 (new) | Add `#### ` heading handler |

### No other files are changed
The on-screen preview already handles all these patterns correctly -- only the Word export needs fixing.

## Technical Detail

### Numbered heading vs numbered list distinction

```text
Current (broken):
  "1. PURPOSE AND SCOPE" --> numbered list item (indented, small text)

Fixed:
  if text after "1. " is ALL UPPERCASE --> render as Heading 1 (bold, blue, no indent)
  else --> render as numbered list item (indented, as before)
```

### Sub-numbered heading pattern

```text
Pattern: /^(\d+\.\d+[\d.]*)\s+(.+)$/
Example: "1.1 Purpose" or "2.3.1 Definitions"
Render: Bold, subHeadingBlue, size 22, spacing before 160, after 80
```

### Nested bullet indent calculation

```text
"- Top level"        --> indent: 0.25 inch, bullet: "bullet"
"  - Second level"   --> indent: 0.50 inch, bullet: "circle"
"    - Third level"  --> indent: 0.75 inch, bullet: "dash"
```

