import { TimestampedSegmentMerger, type TimestampedChunk } from './TimestampedSegmentMerger';

export interface IncrementalTranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  timestamp?: string;
  speaker?: string;
  segment_id?: string;
  start_ms?: number;
  end_ms?: number;
  source?: string;
}

export interface ProcessTranscriptResult {
  wasProcessed: boolean;
  reason?: string;
  wasHallucination?: boolean;
}

export class IncrementalTranscriptHandler {
  private merger: TimestampedSegmentMerger;
  private lastInterimText: string = '';
  private processedSegmentIds: Set<string> = new Set();
  private lastFinalText: string = '';
  
  constructor(
    private onTranscriptUpdate: (fullTranscript: string) => void,
    private onInterimUpdate?: (interimText: string) => void
  ) {
    this.merger = new TimestampedSegmentMerger();
  }

  processTranscript(data: IncrementalTranscriptData): ProcessTranscriptResult {
    // Generate a unique segment ID if not provided
    const segmentId = data.segment_id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Deduplication: Skip if we've already processed this exact segment
    if (data.is_final && this.processedSegmentIds.has(segmentId)) {
      console.log('🚫 Skipping duplicate final segment:', segmentId);
      return { wasProcessed: false, reason: 'Duplicate segment ID' };
    }

    // Clean the text
    const cleanedText = this.cleanText(data.text);
    if (!cleanedText.trim()) {
      return { wasProcessed: false, reason: 'Empty text after cleaning' };
    }

    if (data.is_final) {
      // Handle final text using timestamp-based merging
      return this.processFinalText(cleanedText, segmentId, data);
    } else {
      // Handle interim text
      this.processInterimText(cleanedText);
      return { wasProcessed: false, reason: 'Interim text (not final)' };
    }
  }

  private processFinalText(text: string, segmentId: string, data: IncrementalTranscriptData): ProcessTranscriptResult {
    // Create timestamped chunk for enhanced merging
    const chunk: TimestampedChunk = {
      text,
      start_ms: data.start_ms,
      end_ms: data.end_ms,
      timestamp: data.timestamp ? new Date(data.timestamp).getTime() : undefined,
      confidence: data.confidence,
      isFinal: data.is_final,
      source: data.source || 'incremental',
      speaker: data.speaker,
      id: segmentId
    };

    // Use timestamp-based merger to prevent duplicates
    const result = this.merger.processChunk(chunk);
    
    if (!result.wasProcessed) {
      console.log(`🚫 Chunk not processed: ${result.reason}`);
      return { 
        wasProcessed: false, 
        reason: result.reason,
        wasHallucination: result.wasHallucination 
      };
    }

    // Mark as processed and update
    this.processedSegmentIds.add(segmentId);
    this.lastInterimText = ''; // Clear interim text since we now have final text
    this.lastFinalText = result.text;
    
    // Notify of update
    this.onTranscriptUpdate(this.lastFinalText);
    
    console.log('✅ Added final segment via timestamp merger:', text.substring(0, 50) + '...');
    console.log('📊 Total transcript length:', this.lastFinalText.length);
    
    return { wasProcessed: true };
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
    // Get the current text from the merger
    let fullTranscript = this.merger.getState().lastText;
    
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
    // This method is no longer used since we moved to timestamp-based merging
    // but keeping it for compatibility
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

  // Get final segments from merger
  getFinalSegments(): string[] {
    return this.merger.getState().finalizedSegments.map(s => s.text);
  }

  // Get current interim text
  getCurrentInterim(): string {
    return this.lastInterimText;
  }

  // Clear all transcript data
  clear(): void {
    this.merger.reset();
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
    const mergerState = this.merger.getState();
    return {
      finalSegments: mergerState.finalizedSegments.length,
      hasInterim: this.lastInterimText.length > 0,
      totalCharacters: this.lastFinalText.length,
      processedSegments: this.processedSegmentIds.size
    };
  }
}