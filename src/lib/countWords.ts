/**
 * Consistent word counting utility.
 * Used everywhere word counts are displayed to prevent
 * discrepancies between gross/net figures.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
