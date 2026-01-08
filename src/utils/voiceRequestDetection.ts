/**
 * Voice Request Detection Utility
 * Detects when users want to generate voice/audio files from content
 */

export interface VoiceRequestDetection {
  isVoiceRequest: boolean;
  textToSpeak: string;
  confidence: 'high' | 'medium' | 'low';
}

// High-confidence keywords that clearly indicate voice generation request
const HIGH_CONFIDENCE_PATTERNS = [
  /create\s+(a\s+)?voice\s+file/i,
  /generate\s+(a\s+)?voice\s+file/i,
  /make\s+(a\s+)?voice\s+file/i,
  /create\s+(an?\s+)?audio\s+file/i,
  /generate\s+(an?\s+)?audio\s+file/i,
  /make\s+(an?\s+)?audio\s+file/i,
  /create\s+(a\s+)?voiceover/i,
  /generate\s+(a\s+)?voiceover/i,
  /make\s+(a\s+)?voiceover/i,
  /voice\s*over\s+(of|from|for)\s+this/i,
  /read\s+(this|that|it)\s+(out\s+)?aloud/i,
  /read\s+(this|that|it)\s+out/i,
  /narrate\s+(this|that|it)/i,
  /convert\s+(this|that|it)?\s*to\s+speech/i,
  /text\s+to\s+speech\s+(this|that|it)/i,
  /tts\s+(this|that|it)/i,
  /speak\s+(this|that|it)\s+(to\s+me|out|aloud)?/i,
  /say\s+(this|that|it)\s+(out\s+)?loud/i,
  /audio\s+version\s+(of|from)\s+(this|that)/i,
  /spoken\s+version\s+(of|from)\s+(this|that)/i,
  /turn\s+(this|that|it)\s+into\s+(audio|speech|voice)/i,
  /make\s+(this|that|it)\s+(into\s+)?(audio|speech|a\s+recording)/i,
];

// Medium-confidence keywords that might indicate voice generation
const MEDIUM_CONFIDENCE_PATTERNS = [
  /can\s+you\s+read\s+(this|that|it)/i,
  /please\s+read\s+(this|that|it)/i,
  /audio\s+version/i,
  /spoken\s+version/i,
  /voice\s+recording/i,
  /listen\s+to\s+(this|that)/i,
  /hear\s+(this|that|it)/i,
];

/**
 * Detects if the user message is requesting voice/audio file generation
 */
export function detectVoiceRequest(
  message: string,
  previousMessages: { role: string; content: string }[] = []
): VoiceRequestDetection {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Check high confidence patterns
  for (const pattern of HIGH_CONFIDENCE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        isVoiceRequest: true,
        textToSpeak: extractTextForVoice(previousMessages),
        confidence: 'high'
      };
    }
  }
  
  // Check medium confidence patterns
  for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        isVoiceRequest: true,
        textToSpeak: extractTextForVoice(previousMessages),
        confidence: 'medium'
      };
    }
  }
  
  return {
    isVoiceRequest: false,
    textToSpeak: '',
    confidence: 'low'
  };
}

/**
 * Extracts the text content to convert to speech from previous messages
 * Usually the most recent AI assistant response
 */
export function extractTextForVoice(
  previousMessages: { role: string; content: string }[] = []
): string {
  // Find the most recent assistant message
  for (let i = previousMessages.length - 1; i >= 0; i--) {
    const msg = previousMessages[i];
    if (msg.role === 'assistant' && msg.content && msg.content.trim().length > 0) {
      // Clean up the content - remove markdown images, code blocks, etc.
      let cleanedContent = msg.content
        // Remove markdown images
        .replace(/!\[.*?\]\(.*?\)/g, '')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code
        .replace(/`[^`]+`/g, '')
        // Remove markdown links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove bold/italic markers
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove headers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove horizontal rules
        .replace(/^[-*_]{3,}$/gm, '')
        // Remove bullet points but keep text
        .replace(/^[\s]*[-*+]\s+/gm, '')
        // Remove numbered lists but keep text
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Clean up multiple newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      return cleanedContent;
    }
  }
  
  return '';
}
