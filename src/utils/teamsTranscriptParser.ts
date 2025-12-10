/**
 * Parser for Microsoft Teams transcript formats (VTT and plain text)
 */

export interface ParsedTeamsTranscript {
  plainText: string;
  speakers: string[];
  wordCount: number;
  suggestedTitle: string;
}

/**
 * Parse a Microsoft Teams VTT transcript
 * VTT format example:
 * WEBVTT
 * 
 * 00:00:00.000 --> 00:00:05.000
 * <v John Smith>Hello everyone, welcome to the meeting.</v>
 */
function parseVTT(content: string): ParsedTeamsTranscript {
  const lines = content.split('\n');
  const speakers = new Set<string>();
  const textParts: string[] = [];
  
  let currentSpeaker = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip WEBVTT header and empty lines
    if (trimmed === 'WEBVTT' || trimmed === '' || trimmed.startsWith('NOTE')) {
      continue;
    }
    
    // Skip timestamp lines (e.g., "00:00:00.000 --> 00:00:05.000")
    if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      continue;
    }
    
    // Extract speaker from <v SpeakerName>text</v> format
    const speakerMatch = trimmed.match(/<v\s+([^>]+)>(.+?)<\/v>/);
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      
      speakers.add(speaker);
      
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        textParts.push(`\n${speaker}: ${text}`);
      } else {
        textParts.push(text);
      }
    } else if (trimmed && !trimmed.match(/^\d+$/)) {
      // Regular text without speaker tag
      textParts.push(trimmed);
    }
  }
  
  const plainText = textParts.join(' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    plainText,
    speakers: Array.from(speakers),
    wordCount,
    suggestedTitle: generateSuggestedTitle(plainText, Array.from(speakers))
  };
}

/**
 * Parse a plain text Teams transcript
 * Format example:
 * John Smith: Hello everyone, welcome to the meeting.
 * Jane Doe: Thanks for joining us today.
 */
function parsePlainText(content: string): ParsedTeamsTranscript {
  const lines = content.split('\n');
  const speakers = new Set<string>();
  const textParts: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try to extract speaker from "Speaker Name: text" format
    // Also handle Teams format with timestamps like "0:00:05 John Smith: text"
    const speakerMatch = trimmed.match(/^(?:\d+:\d{2}(?::\d{2})?\s+)?([A-Za-z][A-Za-z\s.'-]+?):\s*(.+)$/);
    
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      
      // Only add if speaker name looks valid (not too long, no weird chars)
      if (speaker.length <= 50 && speaker.length >= 2) {
        speakers.add(speaker);
        textParts.push(`${speaker}: ${text}`);
      } else {
        textParts.push(trimmed);
      }
    } else {
      textParts.push(trimmed);
    }
  }
  
  const plainText = textParts.join('\n').trim();
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    plainText,
    speakers: Array.from(speakers),
    wordCount,
    suggestedTitle: generateSuggestedTitle(plainText, Array.from(speakers))
  };
}

/**
 * Generate a suggested meeting title from the transcript content
 */
function generateSuggestedTitle(text: string, speakers: string[]): string {
  // Try to extract topic from first meaningful sentence
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10);
  
  if (sentences.length > 0) {
    const firstSentence = sentences[0].replace(/^[^:]+:\s*/, '').trim();
    
    // Look for common meeting topic indicators
    const topicMatches = [
      /(?:discuss(?:ing)?|talk(?:ing)? about|meeting (?:about|for|on))\s+(.{10,50})/i,
      /(?:agenda|topic|subject)(?:\s+is)?:?\s*(.{10,50})/i,
      /(?:welcome to|this is)\s+(?:the\s+)?(.{10,50})/i,
    ];
    
    for (const regex of topicMatches) {
      const match = text.match(regex);
      if (match) {
        return `Meeting: ${match[1].trim().replace(/[.,;:]$/, '')}`;
      }
    }
  }
  
  // Fallback: use date and speaker count
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  
  if (speakers.length > 0) {
    return `Teams Meeting - ${dateStr} (${speakers.length} participants)`;
  }
  
  return `Teams Meeting - ${dateStr}`;
}

/**
 * Main parser function - auto-detects format
 */
export function parseTeamsTranscript(content: string): ParsedTeamsTranscript {
  const trimmedContent = content.trim();
  
  // Detect VTT format
  if (trimmedContent.startsWith('WEBVTT') || trimmedContent.includes('<v ')) {
    return parseVTT(trimmedContent);
  }
  
  // Default to plain text parsing
  return parsePlainText(trimmedContent);
}

/**
 * Validate transcript content
 */
export function validateTranscript(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Transcript is empty' };
  }
  
  if (trimmed.length < 50) {
    return { valid: false, error: 'Transcript is too short (minimum 50 characters)' };
  }
  
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 10) {
    return { valid: false, error: 'Transcript has too few words (minimum 10 words)' };
  }
  
  return { valid: true };
}
