// Shared helper to clean up legacy duplicated Action Items / Completed blocks in stored meeting notes.
// This is intentionally conservative and only targets the known duplication patterns.

const normaliseNewlines = (input: string) => input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const isMainHeading = (line: string) => /^#{1,2}\s+\S/.test(line.trim());

const isActionItemsHeading = (line: string) =>
  /^#{1,3}\s*action\s+items?\b/i.test(line.trim());

const isCompletedHeading = (line: string) =>
  /^#{1,3}\s*completed\b/i.test(line.trim()) ||
  /^\*\*\s*completed\s+items\s*:\s*\*\*\s*$/i.test(line.trim());

const isActionRelatedHeading = (line: string) =>
  isActionItemsHeading(line) || isCompletedHeading(line);

const normaliseActionKey = (line: string) =>
  line
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/~~/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const isCompletedBullet = (line: string) =>
  /^[-•*]\s+/.test(line.trim()) && line.includes("~~");

/**
 * Removes all but the last "## Action Items" section (if multiple exist), then collapses repeated "## Completed" blocks into a single block.
 */
export const sanitiseMeetingNotes = (raw: string): string => {
  if (!raw) return raw;

  const originalLines = normaliseNewlines(raw).split("\n");

  // 1) If multiple Action Items sections exist, keep only the last one.
  const actionRanges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < originalLines.length; i++) {
    if (!isActionItemsHeading(originalLines[i])) continue;

    const start = i;
    let end = i + 1;
    while (end < originalLines.length) {
      // Stop at a true new section heading (but allow action-related headings inside the action items area)
      if (isMainHeading(originalLines[end]) && !isActionRelatedHeading(originalLines[end])) break;
      end++;
    }

    actionRanges.push({ start, end });
    i = end - 1;
  }

  let lines = originalLines;
  if (actionRanges.length > 1) {
    const keep = actionRanges[actionRanges.length - 1];
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const inAny = actionRanges.some((r) => i >= r.start && i < r.end);
      if (!inAny) {
        out.push(lines[i]);
        continue;
      }

      // If inside a section we plan to remove, skip it.
      const inKeep = i >= keep.start && i < keep.end;
      if (inKeep) out.push(lines[i]);
    }

    lines = out;
  }

  // 2) Collapse repeated Completed headings into a single Completed block with de-duplicated bullets.
  const result: string[] = [];
  let completedInsertAt: number | null = null;
  const completedItems: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isCompletedHeading(line)) {
      if (completedInsertAt === null) completedInsertAt = result.length;

      // Skip this completed block and collect completed bullets
      i++;
      while (i < lines.length && !(isMainHeading(lines[i]) && !isCompletedHeading(lines[i]))) {
        const l = lines[i];
        if (isCompletedBullet(l)) {
          const key = normaliseActionKey(l);
          if (!seen.has(key)) {
            seen.add(key);
            completedItems.push(l.trim());
          }
        }

        // If we hit another completed heading, break so outer loop can process it
        if (isCompletedHeading(l)) {
          i--;
          break;
        }

        i++;
      }

      i--; // outer loop increment
      continue;
    }

    result.push(line);
  }

  if (completedInsertAt !== null && completedItems.length > 0) {
    const block = ["## Completed", "", ...completedItems, ""];
    result.splice(completedInsertAt, 0, ...block);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
};
