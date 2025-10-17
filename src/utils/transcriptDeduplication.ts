/**
 * Transcript deduplication utilities
 * Provides single-pass deduplication for complete transcripts
 */

/**
 * Performs single-pass deduplication on complete transcript
 * Removes duplicate sentences while preserving all unique content
 * 
 * @param text - The complete transcript text to deduplicate
 * @returns Deduplicated transcript text
 */
export function deduplicateFullTranscript(text: string): string {
  if (!text || text.trim().length === 0) return text;
  
  // Split into sentences
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  const seen = new Set<string>();
  const deduplicated: string[] = [];
  
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().trim();
    
    // Only add if we haven't seen this sentence before
    // Short sentences (like "Yes." or "Thank you.") are kept regardless
    if (normalized.length <= 10) {
      deduplicated.push(sentence);
    } else if (!seen.has(normalized)) {
      seen.add(normalized);
      deduplicated.push(sentence);
    }
  }
  
  // Rejoin sentences with proper punctuation
  return deduplicated.join('. ').trim() + (deduplicated.length > 0 ? '.' : '');
}

/**
 * Simple hash function for text content (used for deduplication)
 */
export function createContentHash(text: string): string {
  let hash = 0;
  const normalized = text.toLowerCase().trim();
  
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString(36);
}
