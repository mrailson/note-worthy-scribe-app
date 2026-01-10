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
  /voice\s+file\s+(from|of)\s+(this|that|the\s+following)/i,
  /create\s+(an?\s+)?audio\s+file/i,
  /generate\s+(an?\s+)?audio\s+file/i,
  /make\s+(an?\s+)?audio\s+file/i,
  /audio\s+file\s+(from|of)\s+(this|that|the\s+following)/i,
  /create\s+(a\s+)?voiceover/i,
  /generate\s+(a\s+)?voiceover/i,
  /make\s+(a\s+)?voiceover/i,
  /voiceover\s+(from|of)\s+(this|that|the\s+following)/i,
  /voice\s*over\s+(of|from|for)\s+(this|the\s+following)/i,
  /read\s+(this|that|it)\s+(out\s+)?aloud/i,
  /read\s+(this|that|it)\s+out/i,
  /narrate\s+(this|that|it)/i,
  /convert\s+(this|that|it)?\s*to\s+speech/i,
  /text\s+to\s+speech/i,
  /tts\s+(this|that|it)/i,
  /speak\s+(this|that|it)/i,
  /say\s+(this|that|it)\s+(out\s+)?loud/i,
  /audio\s+version\s+(of|from)\s+(this|that)/i,
  /spoken\s+version\s+(of|from)\s+(this|that)/i,
  /turn\s+(this|that|it)\s+into\s+(audio|speech|voice)/i,
  /make\s+(this|that|it)\s+(into\s+)?(audio|speech|a\s+recording)/i,
  /record\s+(this|that|it)\s+as\s+(audio|voice|speech)/i,
  // Catch "from the following script" patterns
  /audio\s+file\s+from\s+the\s+following\s+script/i,
  /voice\s+file\s+from\s+the\s+following\s+script/i,
  /create\s+an?\s+audio\s+file\s+from\s+the\s+following/i,
  /generate\s+an?\s+audio\s+file\s+from\s+the\s+following/i,
  // Catch "Use a ... voice:" pattern which indicates inline script
  /use\s+a\s+(?:clear|professional|british)[\s,]+(?:voice|accent)/i,
  // File-based voice generation patterns
  /voice\s+file\s+from\s+(?:this|the)\s+(?:uploaded\s+)?file/i,
  /audio\s+file\s+from\s+(?:this|the)\s+(?:uploaded\s+)?file/i,
  /(?:create|generate|make)\s+(?:a\s+)?voice\s+(?:file\s+)?from\s+(?:this|the)\s+transcript/i,
  /(?:create|generate|make)\s+(?:a\s+)?audio\s+(?:file\s+)?from\s+(?:this|the)\s+transcript/i,
  /read\s+(?:this|the)\s+transcript/i,
  /narrate\s+(?:this|the)\s+(?:uploaded\s+)?file/i,
  /convert\s+(?:this|the)\s+(?:uploaded\s+)?file\s+to\s+(?:speech|audio|voice)/i,
  /voice\s+file\s+from\s+this/i,
  /audio\s+from\s+this/i,
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
  /read\s+this\s+to\s+me/i,
  /voice\s+file/i,
  /audio\s+file/i,
];

/**
 * Extracts text content from uploaded files for voice generation
 */
function extractTextFromUploadedFiles(
  files: { name: string; content: string; type: string }[]
): string {
  // Prioritise text-based files (transcripts, scripts, .txt files)
  const textFiles = files.filter(f => 
    f.type.startsWith('text/') || 
    f.name.endsWith('.txt') ||
    f.name.toLowerCase().includes('transcript') ||
    f.name.toLowerCase().includes('script')
  );
  
  if (textFiles.length > 0) {
    const content = textFiles[0].content.trim();
    if (content.length > 50) {
      console.log('🎤 Extracted text from prioritised file:', textFiles[0].name, '- length:', content.length);
      return content;
    }
  }
  
  // Fallback: use any file with substantial text content
  for (const file of files) {
    if (file.content && file.content.trim().length > 50) {
      console.log('🎤 Extracted text from file:', file.name, '- length:', file.content.trim().length);
      return file.content.trim();
    }
  }
  
  return '';
}

/**
 * Detects if the user message is requesting voice/audio file generation
 */
export function detectVoiceRequest(
  message: string,
  previousMessages: { role: string; content: string }[] = [],
  uploadedFiles?: { name: string; content: string; type: string }[]
): VoiceRequestDetection {
  console.log('🎤 Checking voice request for message:', message);
  console.log('🎤 Uploaded files count:', uploadedFiles?.length || 0);
  
  // Check high confidence patterns
  for (const pattern of HIGH_CONFIDENCE_PATTERNS) {
    if (pattern.test(message)) {
      console.log('🎤 HIGH confidence voice match:', pattern.toString());
      // Priority order: inline text > uploaded files > previous assistant messages
      let textToSpeak = extractInlineTextForVoice(message);
      
      if (!textToSpeak && uploadedFiles && uploadedFiles.length > 0) {
        textToSpeak = extractTextFromUploadedFiles(uploadedFiles);
      }
      
      if (!textToSpeak) {
        textToSpeak = extractTextForVoice(previousMessages);
      }
      console.log('🎤 Text to speak length:', textToSpeak.length);
      return {
        isVoiceRequest: true,
        textToSpeak,
        confidence: 'high'
      };
    }
  }
  
  // Check medium confidence patterns
  for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
    if (pattern.test(message)) {
      console.log('🎤 MEDIUM confidence voice match:', pattern.toString());
      // Priority order: inline text > uploaded files > previous assistant messages
      let textToSpeak = extractInlineTextForVoice(message);
      
      if (!textToSpeak && uploadedFiles && uploadedFiles.length > 0) {
        textToSpeak = extractTextFromUploadedFiles(uploadedFiles);
      }
      
      if (!textToSpeak) {
        textToSpeak = extractTextForVoice(previousMessages);
      }
      console.log('🎤 Text to speak length:', textToSpeak.length);
      return {
        isVoiceRequest: true,
        textToSpeak,
        confidence: 'medium'
      };
    }
  }
  
  console.log('🎤 No voice request detected');
  
  return {
    isVoiceRequest: false,
    textToSpeak: '',
    confidence: 'low'
  };
}

/**
 * Checks if text is just a voice instruction pattern without actual content
 */
function isVoiceInstructionOnly(text: string): boolean {
  const instructionPatterns = [
    /^use\s+a?\s*(?:clear[\s,]*)?(?:professional[\s,]*)?(?:british[\s,]*)?\s*voice:?\s*$/i,
    /^\[note:\s*i\s*(?:have\s+)?uploaded/i,
    /^please\s+(?:analyze|analyse)\s+these?\s+files?/i,
  ];
  
  const cleanedText = text.trim();
  if (cleanedText.length < 50) return true; // Too short to be meaningful content
  
  return instructionPatterns.some(p => p.test(cleanedText));
}

/**
 * Extracts inline text from the user's message when they provide text directly
 * e.g., "create a voice file from this: Here is some text to speak"
 */
export function extractInlineTextForVoice(message: string): string {
  // Patterns to detect inline text after command phrases
  const inlinePatterns = [
    // Match "Use a clear, professional British voice: [script]" - most specific first
    /use\s+a\s+(?:clear[\s,]+)?(?:professional[\s,]+)?(?:british[\s,]+)?voice\s*:\s*(.+)/is,
    /(?:british|professional|clear)\s+voice\s*:\s*(.+)/is,
    // General audio/voice file patterns
    /(?:create|generate|make)\s+(?:a\s+)?(?:voice|audio)\s+file\s+(?:from|of)\s+(?:this|the\s+following(?:\s+script)?)\s*[:\.\-]?\s*(.+)/is,
    /(?:create|generate|make)\s+(?:a\s+)?voiceover\s+(?:from|of)\s+(?:this|the\s+following(?:\s+script)?)\s*[:\.\-]?\s*(.+)/is,
    /voice\s+file\s+(?:from|of)\s+(?:this|the\s+following(?:\s+script)?)\s*[:\.\-]?\s*(.+)/is,
    /audio\s+file\s+(?:from|of|for)\s+(?:this|the\s+following(?:\s+script)?)\s*[:\.\-]?\s*(.+)/is,
    /(?:read|narrate|speak)\s+(?:this|the\s+following)\s*[:\.\-]?\s*(.+)/is,
    /text\s+to\s+speech\s*[:\.\-]?\s*(.+)/is,
    /tts\s*[:\.\-]?\s*(.+)/is,
    /convert\s+to\s+(?:speech|audio|voice)\s*[:\.\-]?\s*(.+)/is,
  ];
  
  for (const pattern of inlinePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let extractedText = match[1].trim();
      
      // Remove the "[Note: I have uploaded...]" metadata that gets appended
      extractedText = extractedText.replace(/\[Note:\s*I\s*(?:have\s+)?uploaded[^\]]*\]/gi, '').trim();
      
      // Skip if extracted text is just voice instruction or too short
      if (isVoiceInstructionOnly(extractedText)) {
        console.log('🎤 Skipping inline extraction - appears to be instruction only');
        continue;
      }
      
      // Only return if we have meaningful content (more than a few words)
      if (extractedText.length > 50) {
        console.log('🎤 Extracted inline text for voice:', extractedText.substring(0, 100) + '...');
        return extractedText;
      }
    }
  }
  
  return '';
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
