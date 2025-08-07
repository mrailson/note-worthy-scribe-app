export interface IncrementalTranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  timestamp?: string;
  speaker?: string;
  segment_id?: string;
}

export class IncrementalTranscriptHandler {
  private finalSegments: string[] = [];
  private lastInterimText: string = '';
  private processedSegmentIds: Set<string> = new Set();
  private lastFinalText: string = '';
  
  constructor(
    private onTranscriptUpdate: (fullTranscript: string) => void,
    private onInterimUpdate?: (interimText: string) => void
  ) {}

  processTranscript(data: IncrementalTranscriptData): void {
    // Generate a unique segment ID if not provided
    const segmentId = data.segment_id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Deduplication: Skip if we've already processed this exact segment
    if (data.is_final && this.processedSegmentIds.has(segmentId)) {
      console.log('🚫 Skipping duplicate final segment:', segmentId);
      return;
    }

    // Clean the text
    const cleanedText = this.cleanText(data.text);
    if (!cleanedText.trim()) return;

    if (data.is_final) {
      // Handle final text
      this.processFinalText(cleanedText, segmentId);
    } else {
      // Handle interim text
      this.processInterimText(cleanedText);
    }
  }

  private processFinalText(text: string, segmentId: string): void {
    // Check if this text is a duplicate of what we already have
    if (this.isDuplicateContent(text)) {
      console.log('🚫 Skipping duplicate final content');
      return;
    }

    // Add to final segments
    this.finalSegments.push(text);
    this.processedSegmentIds.add(segmentId);
    
    // Clear interim text since we now have final text
    this.lastInterimText = '';
    
    // Update the complete transcript
    this.updateFullTranscript();
    
    console.log('✅ Added final segment:', text.substring(0, 50) + '...');
    console.log('📊 Total final segments:', this.finalSegments.length);
  }

  private processInterimText(text: string): void {
    // Replace the last interim text with new interim text
    this.lastInterimText = text;
    
    // Update with current final + interim
    this.updateFullTranscript();
    
    // Notify about interim update if callback provided
    if (this.onInterimUpdate) {
      this.onInterimUpdate(text);
    }
    
    console.log('📝 Updated interim text:', text.substring(0, 50) + '...');
  }

  private updateFullTranscript(): void {
    // Combine all final segments
    let fullTranscript = this.finalSegments.join(' ').trim();
    
    // Add current interim text if available
    if (this.lastInterimText.trim()) {
      fullTranscript = fullTranscript ? 
        `${fullTranscript} ${this.lastInterimText}` : 
        this.lastInterimText;
    }

    // Only update if the content has actually changed
    if (fullTranscript !== this.lastFinalText) {
      this.lastFinalText = fullTranscript;
      this.onTranscriptUpdate(fullTranscript);
    }
  }

  private isDuplicateContent(newText: string): boolean {
    const normalizedNew = this.normalizeText(newText);
    
    // Check if this text is already in our final segments
    for (const segment of this.finalSegments) {
      const normalizedSegment = this.normalizeText(segment);
      
      // Check for exact match
      if (normalizedSegment === normalizedNew) return true;
      
      // Check if new text is a subset of existing segment (but be less aggressive)
      if (normalizedSegment.includes(normalizedNew) && normalizedNew.length > 20 && normalizedNew.length < normalizedSegment.length * 0.9) return true;
      
      // Check if new text is a superset that includes existing segment (but be less aggressive)
      if (normalizedNew.includes(normalizedSegment) && normalizedSegment.length > 20) {
        // This might be an expanded version, but we should be careful
        const overlap = this.calculateOverlap(normalizedSegment, normalizedNew);
        if (overlap > 0.95) return true; // 95% overlap considered duplicate (was 80%)
      }
    }
    
    return false;
  }

  private calculateOverlap(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    const shorter = words1.length < words2.length ? words1 : words2;
    const longer = words1.length >= words2.length ? words1 : words2;
    
    let matchCount = 0;
    for (const word of shorter) {
      if (longer.includes(word)) {
        matchCount++;
      }
    }
    
    return matchCount / shorter.length;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/Thank you for watching\.?\s*/gi, '')
      .replace(/Thanks for watching\.?\s*/gi, '')
      .replace(/Thank you\.?\s*$/gi, '')
      .replace(/Thanks\.?\s*$/gi, '')
      .replace(/Goodbye\.?\s*$/gi, '')
      .replace(/Bye\.?\s*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get current complete transcript
  getFullTranscript(): string {
    return this.lastFinalText;
  }

  // Get only final segments
  getFinalSegments(): string[] {
    return [...this.finalSegments];
  }

  // Get current interim text
  getCurrentInterim(): string {
    return this.lastInterimText;
  }

  // Clear all transcript data
  clear(): void {
    this.finalSegments = [];
    this.lastInterimText = '';
    this.processedSegmentIds.clear();
    this.lastFinalText = '';
    this.onTranscriptUpdate('');
  }

  // Get statistics
  getStats(): {
    finalSegments: number;
    hasInterim: boolean;
    totalCharacters: number;
    processedSegments: number;
  } {
    return {
      finalSegments: this.finalSegments.length,
      hasInterim: this.lastInterimText.length > 0,
      totalCharacters: this.lastFinalText.length,
      processedSegments: this.processedSegmentIds.size
    };
  }
}