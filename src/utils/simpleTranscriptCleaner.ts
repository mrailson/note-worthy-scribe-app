// Simple, reliable transcript cleaner that focuses only on removing duplicates and obvious artifacts
// Replaces the unreliable AI cleaning approach

export interface SimpleCleaningOptions {
  removeRecordingArtifacts?: boolean;
  removeDuplicateSentences?: boolean;
  fixBasicPunctuation?: boolean;
  removeExcessiveRepetition?: boolean;
}

export class SimpleTranscriptCleaner {
  
  public cleanTranscript(text: string, options: SimpleCleaningOptions = {}): string {
    const {
      removeRecordingArtifacts = true,
      removeDuplicateSentences = true,
      fixBasicPunctuation = true,
      removeExcessiveRepetition = true,
    } = options;

    let cleaned = text;

    // Step 1: Remove obvious recording artifacts and system messages
    if (removeRecordingArtifacts) {
      cleaned = this.removeRecordingArtifacts(cleaned);
    }

    // Step 2: Remove consecutive duplicate words (3+ chars minimum)
    if (removeExcessiveRepetition) {
      cleaned = this.removeConsecutiveDuplicateWords(cleaned);
    }

    // Step 3: Remove duplicate sentences
    if (removeDuplicateSentences) {
      cleaned = this.removeDuplicateSentences(cleaned);
    }

    // Step 4: Fix basic punctuation and spacing
    if (fixBasicPunctuation) {
      cleaned = this.fixBasicPunctuation(cleaned);
    }

    // Step 5: Final cleanup
    cleaned = this.finalCleanup(cleaned);

    return cleaned;
  }

  private removeRecordingArtifacts(text: string): string {
    const artifacts = [
      /this\s+meeting\s+is\s+being\s+recorded/gi,
      /recording\s+has\s+started/gi,
      /recording\s+has\s+stopped/gi,
      /please\s+note\s+this\s+call\s+is\s+being\s+recorded/gi,
      /this\s+call\s+is\s+being\s+monitored/gi,
      /for\s+quality\s+and\s+training\s+purposes/gi,
      /welcome\s+to\s+the\s+conference/gi,
      /you\s+are\s+now\s+entering\s+the\s+conference/gi,
      /participants\s+are\s+joining/gi,
      /beep\s*beep/gi,
      /\b(uh\s+){4,}/gi, // Remove excessive "uh uh uh uh"
      /\b(um\s+){4,}/gi, // Remove excessive "um um um um"
    ];

    let cleaned = text;
    artifacts.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    return cleaned;
  }

  private removeConsecutiveDuplicateWords(text: string): string {
    // Remove consecutive duplicate words (minimum 3 characters)
    return text.replace(/\b(\w{3,})\s+\1(\s+\1)*\b/gi, '$1');
  }

  private removeDuplicateSentences(text: string): string {
    const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
    const seen = new Set<string>();
    const result: string[] = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i]?.trim().toLowerCase();
      const punctuation = sentences[i + 1] || '';
      
      if (sentence && sentence.length > 10) {
        // Normalize for comparison (remove extra spaces, case)
        const normalized = sentence.replace(/\s+/g, ' ').trim();
        
        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(sentences[i]);
          if (punctuation) result.push(punctuation);
        }
      } else if (sentence) {
        // Keep short sentences as they might be important
        result.push(sentences[i]);
        if (punctuation) result.push(punctuation);
      }
    }
    
    return result.join('');
  }

  private fixBasicPunctuation(text: string): string {
    let cleaned = text;
    
    // Fix spacing around punctuation
    cleaned = cleaned.replace(/\s+([.!?:;,])/g, '$1');
    cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
    cleaned = cleaned.replace(/([,;:])\s*([a-zA-Z])/g, '$1 $2');
    
    // Fix multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Ensure sentences end with proper punctuation
    cleaned = cleaned.replace(/([a-zA-Z])\s+([A-Z][a-z])/g, '$1. $2');
    
    return cleaned;
  }

  private finalCleanup(text: string): string {
    let cleaned = text;
    
    // Remove empty lines and excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n');
    cleaned = cleaned.replace(/^\s+|\s+$/gm, '');
    cleaned = cleaned.trim();
    
    // Remove lines that are too short to be meaningful (unless they're questions)
    const lines = cleaned.split('\n');
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 8 || trimmed.includes('?') || /^[A-Z][a-z]+:/.test(trimmed);
    });
    
    return meaningfulLines.join('\n').trim();
  }

  // Quick method for basic cleaning without options
  public quickClean(text: string): string {
    return this.cleanTranscript(text, {
      removeRecordingArtifacts: true,
      removeDuplicateSentences: true,
      fixBasicPunctuation: true,
      removeExcessiveRepetition: true,
    });
  }
}

// Export singleton instance
export const simpleTranscriptCleaner = new SimpleTranscriptCleaner();
