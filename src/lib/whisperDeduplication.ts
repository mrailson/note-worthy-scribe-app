/**
 * Whisper Chunk Deduplication
 * 
 * Implements overlap-aware de-duplication across Whisper chunks using
 * sentence similarity comparison. This kills duplication at source by
 * comparing the last sentences of the previous chunk with the first
 * sentences of the new chunk.
 */

// Configuration – aligned with 90s chunk / 3s overlap stitching rule
// Compare last 2–3 sentences of chunk N with first 2–3 of chunk N+1
// If similarity ≥ 0.6 → drop the repeated prefix from chunk N+1
const SIMILARITY_THRESHOLD = 0.60; // Cosine similarity threshold (lowered for overlap stitching)
const TOKEN_OVERLAP_THRESHOLD = 0.60; // Token overlap (Jaccard) threshold
const SENTENCES_TO_COMPARE = 3; // Number of sentences to compare at boundaries

/**
 * Split text into sentences using common sentence boundaries
 */
export function splitIntoSentences(text: string): string[] {
  if (!text?.trim()) return [];
  
  // Split on sentence boundaries, keeping punctuation
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Tokenize text into words (lowercase, alphanumeric only)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^a-z0-9]/g, ''))
    .filter(word => word.length > 0);
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 */
export function calculateTokenOverlap(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate cosine similarity between two token vectors
 */
export function calculateCosineSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // Build term frequency maps
  const tf1 = new Map<string, number>();
  const tf2 = new Map<string, number>();
  
  for (const token of tokens1) {
    tf1.set(token, (tf1.get(token) || 0) + 1);
  }
  for (const token of tokens2) {
    tf2.set(token, (tf2.get(token) || 0) + 1);
  }
  
  // Get all unique terms
  const allTerms = new Set([...tf1.keys(), ...tf2.keys()]);
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (const term of allTerms) {
    const v1 = tf1.get(term) || 0;
    const v2 = tf2.get(term) || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Check if two sentences are duplicates based on similarity thresholds
 */
export function areSentencesDuplicates(sentence1: string, sentence2: string): boolean {
  const tokens1 = tokenize(sentence1);
  const tokens2 = tokenize(sentence2);
  
  // Check cosine similarity
  const cosineSim = calculateCosineSimilarity(tokens1, tokens2);
  if (cosineSim > SIMILARITY_THRESHOLD) {
    return true;
  }
  
  // Check token overlap (Jaccard similarity)
  const tokenOverlap = calculateTokenOverlap(tokens1, tokens2);
  if (tokenOverlap > TOKEN_OVERLAP_THRESHOLD) {
    return true;
  }
  
  return false;
}

/**
 * State for tracking previous chunk's trailing sentences
 */
export interface DeduplicationState {
  trailingSentences: string[];
  lastChunkIndex: number;
}

/**
 * Create initial deduplication state
 */
export function createDeduplicationState(): DeduplicationState {
  return {
    trailingSentences: [],
    lastChunkIndex: -1
  };
}

/**
 * Deduplicate incoming chunk text against previous chunk's trailing sentences.
 * Returns the deduplicated text and updates the state with new trailing sentences.
 */
export function deduplicateChunk(
  incomingText: string,
  state: DeduplicationState,
  chunkIndex: number
): { text: string; duplicatesRemoved: number; state: DeduplicationState } {
  if (!incomingText?.trim()) {
    return { text: '', duplicatesRemoved: 0, state };
  }
  
  const incomingSentences = splitIntoSentences(incomingText);
  
  if (incomingSentences.length === 0) {
    return { text: incomingText, duplicatesRemoved: 0, state };
  }
  
  let duplicatesRemoved = 0;
  let startIndex = 0;
  
  // Compare first N sentences of incoming with trailing sentences of previous
  if (state.trailingSentences.length > 0 && chunkIndex > state.lastChunkIndex) {
    const sentencesToCheck = Math.min(SENTENCES_TO_COMPARE, incomingSentences.length);
    
    for (let i = 0; i < sentencesToCheck; i++) {
      const incomingSentence = incomingSentences[i];
      let isDuplicate = false;
      
      for (const trailingSentence of state.trailingSentences) {
        if (areSentencesDuplicates(incomingSentence, trailingSentence)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (isDuplicate) {
        startIndex = i + 1;
        duplicatesRemoved++;
      } else {
        // Stop checking once we find a non-duplicate
        break;
      }
    }
  }
  
  // Extract non-duplicate sentences
  const deduplicatedSentences = incomingSentences.slice(startIndex);
  
  // Update state with new trailing sentences
  const newTrailingSentences = incomingSentences.slice(
    Math.max(0, incomingSentences.length - SENTENCES_TO_COMPARE)
  );
  
  const newState: DeduplicationState = {
    trailingSentences: newTrailingSentences,
    lastChunkIndex: chunkIndex
  };
  
  const deduplicatedText = deduplicatedSentences.join(' ');
  
  if (duplicatesRemoved > 0) {
    console.log(`🔍 Whisper deduplication: removed ${duplicatesRemoved} duplicate sentence(s) from chunk ${chunkIndex}`);
  }
  
  return {
    text: deduplicatedText,
    duplicatesRemoved,
    state: newState
  };
}

/**
 * Full-text deduplication for batch processing (e.g., when consolidating chunks)
 * Removes duplicate sentences that appear consecutively
 */
export function deduplicateFullText(text: string): { text: string; duplicatesRemoved: number } {
  if (!text?.trim()) {
    return { text: '', duplicatesRemoved: 0 };
  }
  
  const sentences = splitIntoSentences(text);
  if (sentences.length <= 1) {
    return { text, duplicatesRemoved: 0 };
  }
  
  const deduplicatedSentences: string[] = [sentences[0]];
  let duplicatesRemoved = 0;
  
  for (let i = 1; i < sentences.length; i++) {
    const currentSentence = sentences[i];
    const previousSentence = deduplicatedSentences[deduplicatedSentences.length - 1];
    
    // Check against the previous 2 sentences for duplicates
    let isDuplicate = false;
    const lookback = Math.min(SENTENCES_TO_COMPARE, deduplicatedSentences.length);
    
    for (let j = 0; j < lookback; j++) {
      const compareIndex = deduplicatedSentences.length - 1 - j;
      if (compareIndex >= 0 && areSentencesDuplicates(currentSentence, deduplicatedSentences[compareIndex])) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicatedSentences.push(currentSentence);
    } else {
      duplicatesRemoved++;
    }
  }
  
  const deduplicatedText = deduplicatedSentences.join(' ');
  
  if (duplicatesRemoved > 0) {
    console.log(`🔍 Full-text deduplication: removed ${duplicatesRemoved} duplicate sentence(s)`);
  }
  
  return {
    text: deduplicatedText,
    duplicatesRemoved
  };
}
