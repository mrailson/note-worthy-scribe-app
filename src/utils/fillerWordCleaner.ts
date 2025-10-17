/**
 * Utility for removing filler words and phrases from transcripts
 */

export const FILLER_WORDS = [
  'um', 'uh', 'er', 'erm', 'ah', 'mm', 'hmm', 'uh-huh', 'mm-hmm'
];

export const FILLER_PHRASES = [
  'you know', 'like', 'sort of', 'kind of', 'i mean', 'you see',
  'basically', 'actually', 'literally', 'essentially', 'obviously',
  'you know what i mean', 'if you will', 'so to speak', 'at the end of the day'
];

export interface FillerWordStats {
  totalRemoved: number;
  wordCount: Record<string, number>;
  phraseCount: Record<string, number>;
}

/**
 * Remove filler words from text while preserving structure
 */
export function removeFillerWords(text: string, options: {
  removeWords?: boolean;
  removePhrases?: boolean;
  caseSensitive?: boolean;
} = {}): { cleaned: string; stats: FillerWordStats } {
  const { 
    removeWords = true, 
    removePhrases = true,
    caseSensitive = false 
  } = options;

  let cleaned = text;
  const stats: FillerWordStats = {
    totalRemoved: 0,
    wordCount: {},
    phraseCount: {}
  };

  // Remove filler phrases first (longer matches)
  if (removePhrases) {
    for (const phrase of FILLER_PHRASES) {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${phrase}\\b[,\\s]*`, flags);
      const matches = cleaned.match(regex);
      if (matches) {
        stats.phraseCount[phrase] = matches.length;
        stats.totalRemoved += matches.length;
        cleaned = cleaned.replace(regex, ' ');
      }
    }
  }

  // Remove individual filler words
  if (removeWords) {
    for (const word of FILLER_WORDS) {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${word}\\b[,\\s]*`, flags);
      const matches = cleaned.match(regex);
      if (matches) {
        stats.wordCount[word] = matches.length;
        stats.totalRemoved += matches.length;
        cleaned = cleaned.replace(regex, ' ');
      }
    }
  }

  // Clean up excessive whitespace while preserving paragraph breaks (double newlines)
  cleaned = cleaned
    .split('\n\n')  // Split on paragraph breaks
    .map(para => para
      .replace(/\s+/g, ' ')  // Clean whitespace within each paragraph
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim()
    )
    .join('\n\n');  // Rejoin with paragraph breaks preserved

  return { cleaned, stats };
}

/**
 * Count filler words in text without removing them
 */
export function countFillerWords(text: string): FillerWordStats {
  const stats: FillerWordStats = {
    totalRemoved: 0,
    wordCount: {},
    phraseCount: {}
  };

  // Count phrases
  for (const phrase of FILLER_PHRASES) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      stats.phraseCount[phrase] = matches.length;
      stats.totalRemoved += matches.length;
    }
  }

  // Count words
  for (const word of FILLER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      stats.wordCount[word] = matches.length;
      stats.totalRemoved += matches.length;
    }
  }

  return stats;
}
