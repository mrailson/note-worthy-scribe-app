## Problem

On long meetings, two sections render as one giant clumped paragraph in the email body and the attached Word doc:

1. **Decisions Register** — every `AGREED — …` / `NOTED — …` / `RESOLVED — …` entry is run together on one line, instead of one entry per line.
2. **Open Items & Risks** — risks separated by " - " inside one paragraph instead of as bullets.

The blue section heading (`DECISIONS REGISTER`, `OPEN ITEMS & RISKS`, `ACTION ITEMS`) shows on some meetings and not others because the AI sometimes welds the heading onto the end of the previous paragraph, so the renderer never matches it as a standalone ALL-CAPS line. Also the first `AGREED:` in a clump is styled blue/bold but subsequent ones aren't, because they're treated as plain inline text.

This violates the project rule (memory: governance decisions register) that each entry must be on its own plain line as `LABEL — text`.

## Fix

Add one shared pre-processor that runs before both the email HTML renderer and the Word renderer. It does four things:

1. **Split governance entries onto their own lines.** Insert a newline before any `RESOLVED — `, `AGREED — `, `NOTED — ` token that appears mid-paragraph (i.e. is preceded by other text on the same line).
2. **Split run-on risk/open-item paragraphs.** When a paragraph under `OPEN ITEMS & RISKS` contains repeated ` - ` separators, convert each segment into a bullet line.
3. **Detach welded section headings.** Force a newline before `DECISIONS REGISTER`, `OPEN ITEMS & RISKS`, `ACTION ITEMS`, `OPEN ITEMS`, `RISKS`, `NEXT STEPS` whenever they appear after non-newline text.
4. **Add breathing room** between governance entries in the rendered output (small `margin-bottom` in email, `spacing.after` in docx) so the block reads as a list, not a wall.

## Files to change

### `src/utils/meetingEmailBuilder.ts`
- Add a new `splitClumpedSections(text)` helper at top of file.
- Call it inside `convertToStyledHTML` immediately after `stripDuplicateBlocks`.
- Bump the governance line `<p>` margin from `8px 0` to `10px 0 10px 20px` so consecutive entries breathe.
- Keep the existing per-line governance match — once split, each entry will hit it cleanly.

### `src/utils/generateProfessionalMeetingDocx.ts`
- Import / inline the same `splitClumpedSections` helper.
- Apply it to `cleanedContent` near line 1414 (just after `normaliseMeetingNotesFormatting`).
- Add a governance-line branch in the parser loop (mirroring the email's `governanceMatch`) that renders `LABEL — text` as a plain indented paragraph with `spacing.after: 120` so each entry sits on its own line in the Word doc.

### Shared helper logic (in both files, or a small new `src/utils/meeting/normaliseGovernanceLayout.ts` imported by both)

```text
splitClumpedSections(text):
  # 1. Detach welded section headings
  text = text.replace(/(\S)[ \t]*(DECISIONS REGISTER|OPEN ITEMS(?: & RISKS)?|ACTION ITEMS|RISKS|NEXT STEPS)\b/g,
                       "$1\n\n$2")
  # 2. Split governance entries
  text = text.replace(/([^\n])\s+(RESOLVED|AGREED|NOTED)\s+—\s+/g, "$1\n$2 — ")
  # 3. Split run-on risk paragraphs:
  #    inside any paragraph that follows OPEN ITEMS & RISKS and contains
  #    two or more " - " markers, replace " - " with "\n- "
  text = applyToOpenItemsBlock(text, para =>
    (para.match(/ - /g)?.length ?? 0) >= 2
      ? para.replace(/\s+-\s+/g, "\n- ")
      : para
  )
  return text
```

Creating the helper as its own module keeps the email and docx paths in lock-step and avoids drift.

## Result

- Each `AGREED / NOTED / RESOLVED` entry sits on its own plain line, no bold colour, no bullet — matches the project rule.
- `DECISIONS REGISTER`, `OPEN ITEMS & RISKS`, `ACTION ITEMS` always render as the blue uppercase heading because they always start a new line.
- Risks list reads as bullets, not a wall of text.
- Same layout in the email body and the attached Word doc, so before/after comparison in the Pipeline Test is consistent.

No backend / edge function changes needed — this is purely renderer-side, so it fixes the email body and Word attachment for every existing meeting on the next send.