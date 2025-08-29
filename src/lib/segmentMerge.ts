export type Segment = { start: number; end: number; text: string }; // seconds

// Keep everything strictly after the last accepted boundary.
// Small grace avoids flicker from near-identical timings.
const GRACE_S = 0.10; // 100 ms

export function mergeByTimestamps(
  existing: Segment[],
  incoming: Segment[],
): Segment[] {
  if (!incoming?.length) return existing ?? [];
  const safeExisting = existing ?? [];
  const lastEnd = safeExisting.length ? safeExisting[safeExisting.length - 1].end : 0;

  const merged: Segment[] = [...safeExisting];

  for (const seg of incoming) {
    if (!seg || typeof seg.start !== 'number' || typeof seg.end !== 'number') continue;

    // Drop segments that end before (or almost before) our current boundary
    if (seg.end <= lastEnd + GRACE_S) continue;

    // If segment overlaps a bit, trim its start to the boundary to avoid repeats
    const trimmedStart = Math.max(seg.start, lastEnd);
    const trimmedText = (seg.text || '').trim();

    if (!trimmedText) continue;

    // If the start moved beyond end due to trimming, skip
    if (trimmedStart >= seg.end) continue;

    // Push a (possibly trimmed) copy
    merged.push({
      start: trimmedStart,
      end: seg.end,
      text: trimmedText,
    });
  }

  return merged;
}

// Build a readable string from merged segments with clean spacing.
export function segmentsToPlainText(segments: Segment[]): string {
  return (segments ?? [])
    .map(s => s.text)
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')      // no space before punctuation
    .replace(/\s{2,}/g, ' ')              // collapse doubles
    .trim();
}
