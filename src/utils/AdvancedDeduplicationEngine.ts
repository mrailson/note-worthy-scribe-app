// Advanced Deduplication Engine for Phase 4
// Unified system to eliminate transcript repetitions

export interface DeduplicationConfig {
  // Rolling window deduplication
  sentenceWindow: number;           // How many sentences to analyze (3-5)
  semanticThreshold: number;        // Semantic similarity threshold (0.85-0.95)
  
  // Chunked processing
  chunkOverlapThreshold: number;    // Chunk overlap similarity threshold
  temporalGapMs: number;            // Min gap between chunks to avoid overlap
  
  // Pattern filtering
  phraseRepetitionThreshold: number; // Phrase-level repetition detection
  conversationFlowWeight: number;    // Weight for conversation flow analysis
  
  // Real-time monitoring
  retroactiveCleaningEnabled: boolean; // Enable retroactive cleaning
  maxLookbackSentences: number;      // Max sentences to look back for patterns
}

export interface DeduplicationResult {
  cleanedText: string;
  removedSegments: Array<{
    text: string;
    reason: string;
    confidence: number;
    type: 'semantic_duplicate' | 'chunk_overlap' | 'phrase_repetition' | 'flow_break' | 'retroactive_clean';
  }>;
  stats: {
    originalLength: number;
    cleanedLength: number;
    segmentsRemoved: number;
    processingTimeMs: number;
  };
}

export interface ChunkMetadata {
  text: string;
  confidence: number;
  timestamp: number;
  source: string;
  chunkId: string;
  isFinal: boolean;
}

export class AdvancedDeduplicationEngine {
  private config: DeduplicationConfig;
  private recentChunks: ChunkMetadata[] = [];
  private processedSentences: Array<{ text: string; normalizedText: string; timestamp: number }> = [];
  
  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = {
      sentenceWindow: 4,
      semanticThreshold: 0.88,
      chunkOverlapThreshold: 0.82,
      temporalGapMs: 500,
      phraseRepetitionThreshold: 0.90,
      conversationFlowWeight: 0.3,
      retroactiveCleaningEnabled: true,
      maxLookbackSentences: 15,
      ...config
    };
  }

  /**
   * Main entry point: Process a new chunk and return deduplicated result
   */
  processChunk(chunk: ChunkMetadata, previousTranscript: string = ''): DeduplicationResult {
    const startTime = Date.now();
    const originalText = previousTranscript + (previousTranscript ? ' ' : '') + chunk.text;
    
    // Step 1: Chunk-level overlap detection
    const chunkProcessed = this.processChunkOverlap(chunk, previousTranscript);
    
    // Step 2: Enhanced rolling window deduplication
    const windowProcessed = this.enhancedRollingWindowDedup(chunkProcessed);
    
    // Step 3: Advanced pattern filtering
    const patternProcessed = this.advancedPatternFiltering(windowProcessed);
    
    // Step 4: Conversation flow analysis
    const flowProcessed = this.conversationFlowAnalysis(patternProcessed);
    
    // Step 5: Retroactive cleaning if enabled
    const finalProcessed = this.config.retroactiveCleaningEnabled 
      ? this.retroactiveCleanup(flowProcessed)
      : flowProcessed;

    const endTime = Date.now();
    
    // Update internal state
    this.updateInternalState(chunk, finalProcessed);
    
    return {
      cleanedText: finalProcessed,
      removedSegments: this.getLastRemovedSegments(),
      stats: {
        originalLength: originalText.length,
        cleanedLength: finalProcessed.length,
        segmentsRemoved: this.getLastRemovedSegments().length,
        processingTimeMs: endTime - startTime
      }
    };
  }

  /**
   * Step 1: Process chunk overlap using improved temporal and content analysis
   */
  private processChunkOverlap(chunk: ChunkMetadata, previousTranscript: string): string {
    // Check if chunk is too close temporally to previous chunks
    const recentChunk = this.recentChunks
      .filter(c => c.timestamp > chunk.timestamp - this.config.temporalGapMs)
      .pop();
    
    if (recentChunk && this.calculateSemanticSimilarity(chunk.text, recentChunk.text) > this.config.chunkOverlapThreshold) {
      console.log(`🔗 Detected chunk overlap: \"${chunk.text.substring(0, 40)}...\" (similarity: ${this.calculateSemanticSimilarity(chunk.text, recentChunk.text).toFixed(3)})`);
      
      // Choose the chunk with higher confidence
      if (chunk.confidence > recentChunk.confidence) {
        // Remove the previous chunk's contribution and add this one
        return this.replaceLastChunkContribution(previousTranscript, recentChunk.text, chunk.text);
      } else {
        // Skip this chunk as the previous one had higher confidence
        return previousTranscript;
      }
    }

    return previousTranscript + (previousTranscript ? ' ' : '') + chunk.text;
  }

  /**
   * Step 2: Enhanced rolling window deduplication with semantic analysis
   */
  private enhancedRollingWindowDedup(text: string): string {
    const sentences = this.splitIntoSentences(text);
    const deduplicated: string[] = [];
    
    for (const sentence of sentences) {
      const normalizedSentence = this.normalizeText(sentence);
      
      // Check against the last N sentences in our window
      const recentSentences = deduplicated.slice(-this.config.sentenceWindow);
      const isDuplicate = recentSentences.some(recent => 
        this.calculateSemanticSimilarity(normalizedSentence, this.normalizeText(recent)) > this.config.semanticThreshold
      );
      
      if (!isDuplicate) {
        deduplicated.push(sentence);
      } else {
        console.log(`🚫 Semantic duplicate detected: \"${sentence.substring(0, 50)}...\"`);
        this.addRemovedSegment(sentence, 'Semantic duplicate within rolling window', 1.0, 'semantic_duplicate');
      }
    }
    
    return deduplicated.join(' ');
  }

  /**
   * Step 3: Advanced pattern filtering for phrase-level repetitions
   */
  private advancedPatternFiltering(text: string): string {
    // Split into phrases (not just sentences)
    const phrases = this.extractPhrases(text);
    const filtered: string[] = [];
    
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      const normalizedPhrase = this.normalizeText(phrase);
      
      // Look for repetition patterns in recent phrases
      let isRepetitive = false;
      for (let j = Math.max(0, i - 10); j < i; j++) {
        const previousPhrase = this.normalizeText(phrases[j]);
        if (this.calculateSemanticSimilarity(normalizedPhrase, previousPhrase) > this.config.phraseRepetitionThreshold) {
          console.log(`🔄 Phrase repetition detected: \"${phrase.substring(0, 40)}...\"`);
          this.addRemovedSegment(phrase, 'Phrase-level repetition detected', 1.0, 'phrase_repetition');
          isRepetitive = true;
          break;
        }
      }
      
      if (!isRepetitive) {
        filtered.push(phrase);
      }
    }
    
    return this.reconstructFromPhrases(filtered);
  }

  /**
   * Step 4: Conversation flow analysis to detect unnatural breaks/repeats
   */
  private conversationFlowAnalysis(text: string): string {
    const sentences = this.splitIntoSentences(text);
    const analyzed: string[] = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (i === 0) {
        analyzed.push(sentence);
        continue;
      }
      
      const previousSentence = sentences[i - 1];
      const flowScore = this.calculateConversationFlow(previousSentence, sentence);
      
      // If flow is unnaturally low, it might indicate a repetition restart
      if (flowScore < this.config.conversationFlowWeight && 
          this.detectRestartPattern(previousSentence, sentence)) {
        console.log(`🔀 Flow break detected: \"${sentence.substring(0, 40)}...\" (flow score: ${flowScore.toFixed(3)})`);
        this.addRemovedSegment(sentence, 'Conversation flow interruption', flowScore, 'flow_break');
        continue;
      }
      
      analyzed.push(sentence);
    }
    
    return analyzed.join(' ');
  }

  /**
   * Step 5: Retroactive cleanup for patterns that span multiple sentences
   */
  private retroactiveCleanup(text: string): string {
    const sentences = this.splitIntoSentences(text);
    
    // Look for longer repetition patterns (3+ sentences)
    for (let windowSize = 3; windowSize <= Math.min(6, Math.floor(sentences.length / 2)); windowSize++) {
      for (let i = 0; i <= sentences.length - (windowSize * 2); i++) {
        const window1 = sentences.slice(i, i + windowSize);
        const window1Text = window1.join(' ');
        
        // Look for similar patterns later in the text
        for (let j = i + windowSize; j <= sentences.length - windowSize; j++) {
          const window2 = sentences.slice(j, j + windowSize);
          const window2Text = window2.join(' ');
          
          const similarity = this.calculateSemanticSimilarity(
            this.normalizeText(window1Text), 
            this.normalizeText(window2Text)
          );
          
          if (similarity > 0.85) {
            console.log(`🎯 Retroactive cleanup: Found ${windowSize}-sentence repetition (similarity: ${similarity.toFixed(3)})`);
            console.log(`   Pattern 1: \"${window1Text.substring(0, 80)}...\"`);
            console.log(`   Pattern 2: \"${window2Text.substring(0, 80)}...\"`);
            
            // Remove the second occurrence
            sentences.splice(j, windowSize);
            this.addRemovedSegment(window2Text, `${windowSize}-sentence repetition pattern`, similarity, 'retroactive_clean');
            
            // Restart the search as sentence indices have changed
            return this.retroactiveCleanup(sentences.join(' '));
          }
        }
      }
    }
    
    return sentences.join(' ');
  }

  // Utility methods
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?…])\s+(?=[A-Z\"\"'\[]|So\s|The\s|First\s|Next\s|Okay\s|Right\s|Now\s)/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  private extractPhrases(text: string): string[] {
    // Extract phrases using punctuation and natural speech markers
    return text
      .split(/[,.;:]|\s(?=and\s|but\s|so\s|then\s|now\s|okay\s|right\s|well\s)/i)
      .map(p => p.trim())
      .filter(p => p.length > 10); // Filter out very short phrases
  }

  private reconstructFromPhrases(phrases: string[]): string {
    return phrases.join(' ')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\\w\\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    // Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSim = intersection.size / (union.size || 1);
    
    // Also calculate n-gram similarity for better accuracy
    const bigrams1 = this.generateNGrams(text1, 2);
    const bigrams2 = this.generateNGrams(text2, 2);
    const bigramIntersection = new Set([...bigrams1].filter(bg => bigrams2.has(bg)));
    const bigramUnion = new Set([...bigrams1, ...bigrams2]);
    const bigramSim = bigramIntersection.size / (bigramUnion.size || 1);
    
    // Weighted combination
    return (jaccardSim * 0.4) + (bigramSim * 0.6);
  }

  private generateNGrams(text: string, n: number): Set<string> {
    const words = text.toLowerCase().split(/\s+/);
    const ngrams = new Set<string>();
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  private calculateConversationFlow(prev: string, current: string): number {
    // Simple heuristic for conversation flow
    // Check for natural transitions vs abrupt restarts
    
    const prevEnding = prev.toLowerCase().trim();
    const currentStart = current.toLowerCase().trim();
    
    // Natural continuations
    if (prevEnding.endsWith('?') && (currentStart.startsWith('no') || currentStart.startsWith('yes') || currentStart.startsWith('okay'))) {
      return 1.0;
    }
    
    // Abrupt restarts (same beginning patterns)
    const commonStarters = ['first', 'so', 'now', 'okay', 'right', 'the', 'here'];
    const prevStarter = prevEnding.split(' ')[0];
    const currentStarter = currentStart.split(' ')[0];
    
    if (commonStarters.includes(prevStarter) && commonStarters.includes(currentStarter)) {
      return 0.1; // Very low flow - likely repetition
    }
    
    return 0.7; // Default moderate flow
  }

  private detectRestartPattern(prev: string, current: string): boolean {
    const restartPatterns = [
      /^(first|so|now|okay|right),?\s+(just\s+)?to/i,
      /^(here|the|this)\s+(is|are)/i,
      /^let'?s\s+(begin|start)/i,
      /^we'?ve\s+seen/i
    ];
    
    return restartPatterns.some(pattern => 
      pattern.test(prev.trim()) && pattern.test(current.trim())
    );
  }

  private replaceLastChunkContribution(text: string, oldChunk: string, newChunk: string): string {
    const lastIndex = text.lastIndexOf(oldChunk);
    if (lastIndex !== -1) {
      return text.substring(0, lastIndex) + newChunk;
    }
    return text + ' ' + newChunk;
  }

  private updateInternalState(chunk: ChunkMetadata, processedText: string): void {
    // Update recent chunks (keep last 10)
    this.recentChunks.push(chunk);
    if (this.recentChunks.length > 10) {
      this.recentChunks.shift();
    }
    
    // Update processed sentences
    const sentences = this.splitIntoSentences(processedText);
    const newSentences = sentences.slice(-5); // Keep last 5 sentences
    
    for (const sentence of newSentences) {
      this.processedSentences.push({
        text: sentence,
        normalizedText: this.normalizeText(sentence),
        timestamp: Date.now()
      });
    }
    
    // Keep only recent sentences (last 50)
    if (this.processedSentences.length > 50) {
      this.processedSentences = this.processedSentences.slice(-50);
    }
  }

  // Track removed segments for reporting
  private lastRemovedSegments: DeduplicationResult['removedSegments'] = [];
  
  private addRemovedSegment(text: string, reason: string, confidence: number, type: DeduplicationResult['removedSegments'][0]['type']): void {
    this.lastRemovedSegments.push({ text, reason, confidence, type });
  }
  
  private getLastRemovedSegments(): DeduplicationResult['removedSegments'] {
    const segments = [...this.lastRemovedSegments];
    this.lastRemovedSegments = []; // Clear for next processing
    return segments;
  }

  // Configuration management
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  // Reset state
  reset(): void {
    this.recentChunks = [];
    this.processedSentences = [];
    this.lastRemovedSegments = [];
  }
}
