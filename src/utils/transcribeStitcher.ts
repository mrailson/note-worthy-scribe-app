/**
 * Stitches incoming transcript text with existing text, removing duplicates
 * Looks for overlapping words between the end of existing text and start of incoming text
 */
export function stitchNoDup(existing: string, incomingRaw: string): string {
  const incoming = (incomingRaw || "").trim();
  if (!incoming) return existing;
  if (!existing) return incoming;
  
  const SEP = " ";
  const tailWords = existing.split(/\s+/).slice(-60); // Last 60 words
  const headWords = incoming.split(/\s+/);
  const maxOverlap = Math.min(tailWords.length, headWords.length, 40);
  
  // Look for overlapping sequences, starting with longer overlaps
  for (let w = maxOverlap; w >= 8; w--) {
    const tailSlice = tailWords.slice(tailWords.length - w).join(SEP);
    const headSlice = headWords.slice(0, w).join(SEP);
    
    if (tailSlice === headSlice) {
      // Found overlap, merge by taking existing + remaining new words
      return existing + SEP + headWords.slice(w).join(SEP);
    }
  }
  
  // No significant overlap found, just concatenate with appropriate spacing
  const needsSpace = !existing.endsWith(" ") && !incoming.startsWith(" ");
  return existing + (needsSpace ? SEP : "") + incoming;
}