/**
 * Utility functions for merging transcripts and avoiding duplication
 */

export function mergeTranscripts(previousText: string, newText: string): string {
  if (!newText || !newText.trim()) return previousText;
  if (!previousText || !previousText.trim()) return newText.trim();
  
  const prev = previousText.trim();
  const newTxt = newText.trim();
  
  // If the new text is completely contained in the previous text, return previous
  if (prev.includes(newTxt)) {
    return prev;
  }
  
  // If the previous text is completely contained in the new text, return new
  if (newTxt.includes(prev)) {
    return newTxt;
  }
  
  // Check for overlap at the end of previous and start of new
  const overlap = findOverlap(prev, newTxt);
  if (overlap > 0) {
    // Remove the overlapping part from the new text
    const uniqueNewPart = newTxt.substring(overlap);
    return prev + ' ' + uniqueNewPart;
  }
  
  // No overlap found, just concatenate with a space
  return prev + ' ' + newTxt;
}

function findOverlap(text1: string, text2: string): number {
  const words1 = text1.split(' ');
  const words2 = text2.split(' ');
  
  let maxOverlap = 0;
  
  // Check for word-level overlaps (minimum 3 words to consider it real overlap)
  for (let i = Math.max(0, words1.length - 10); i < words1.length; i++) {
    const suffix = words1.slice(i).join(' ');
    if (text2.startsWith(suffix) && words1.slice(i).length >= 3) {
      maxOverlap = Math.max(maxOverlap, suffix.length);
    }
  }
  
  return maxOverlap;
}

export function deduplicateTranscripts(transcripts: string[]): string {
  if (transcripts.length === 0) return '';
  if (transcripts.length === 1) return transcripts[0];
  
  let result = transcripts[0];
  
  for (let i = 1; i < transcripts.length; i++) {
    result = mergeTranscripts(result, transcripts[i]);
  }
  
  return result;
}

export function cleanFinalTranscript(text: string): string {
  if (!text) return '';
  
  // Remove excessive repetition (more than 2 identical phrases)
  text = text.replace(/\b(.{10,}?)\s+\1\s+\1(\s+\1)*\b/gi, '$1');
  
  // Remove common transcription artifacts
  const artifacts = [
    /\bthank you\b(?:\s+\bthank you\b){2,}/gi,
    /\bokay\b(?:\s+\bokay\b){3,}/gi,
    /\byeah\b(?:\s+\byeah\b){3,}/gi,
    /\bum\b(?:\s+\bum\b){2,}/gi,
    /\buh\b(?:\s+\buh\b){2,}/gi,
  ];
  
  artifacts.forEach(pattern => {
    text = text.replace(pattern, (match) => {
      const word = match.split(/\s+/)[0];
      return word;
    });
  });
  
  // Clean up spacing and punctuation
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/([.!?])\s*\1+/g, '$1'); // Remove duplicate punctuation
  
  return text;
}