import { UploadedFile } from '@/types/ai4gp';
import { isReferringToPreviousContent, extractTopicFromContent } from '@/utils/imageRequestDetection';

export interface PowerPointRequestDetection {
  isPowerPointRequest: boolean;
  presentationType: 'executive-overview' | 'clinical-guidelines' | 'patient-education' | 'training' | 'board-meeting' | 'partnership-meeting' | 'neighbourhood-meeting' | 'research' | 'general';
  topic: string;
  slideCount?: number;
  confidence: 'high' | 'medium' | 'low';
  useUploadedFiles: boolean;
  customInstructions?: string;
}

// High-confidence patterns that clearly indicate PowerPoint generation
const HIGH_CONFIDENCE_PATTERNS: RegExp[] = [
  // Direct PowerPoint requests
  /create\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slide\s*deck)/i,
  /generate\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slide\s*deck)/i,
  /make\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slide\s*deck)/i,
  /build\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slide\s*deck)/i,
  
  // Turn into slides
  /turn\s+(?:this|that|it|the\s+\w+)\s+into\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slides?)/i,
  /convert\s+(?:this|that|it|the\s+\w+)\s+(?:to|into)\s+(?:a\s+)?(?:power\s*point|pptx?|presentation|slides?)/i,
  
  // Slides from content
  /(?:create|generate|make)\s+slides?\s+(?:from|using|based\s+on)/i,
  /slides?\s+(?:from|using)\s+(?:this|that|the\s+\w+|uploaded)/i,
  
  // Specific meeting presentations
  /(?:board|pcn|partnership|neighbourhood|team)\s+(?:meeting\s+)?presentation/i,
  /presentation\s+for\s+(?:the\s+)?(?:board|pcn|partners|team|staff)/i,
  
  // Executive overview
  /executive\s+(?:overview|summary)\s+presentation/i,
  /(?:create|generate|make)\s+(?:an?\s+)?executive\s+(?:overview|summary)/i,
];

// Medium-confidence patterns
const MEDIUM_CONFIDENCE_PATTERNS: RegExp[] = [
  /(?:power\s*point|pptx?|presentation)\s+(?:about|on|for|from)/i,
  /need\s+(?:a\s+)?(?:power\s*point|presentation|slides?)/i,
  /want\s+(?:a\s+)?(?:power\s*point|presentation|slides?)/i,
  /can\s+you\s+(?:create|make|generate)\s+(?:a\s+)?(?:power\s*point|presentation|slides?)/i,
  /prepare\s+(?:a\s+)?(?:power\s*point|presentation|slides?)/i,
  /(?:\d+)\s+slides?\s+(?:on|about|for)/i,
];

// Presentation type patterns
const PRESENTATION_TYPE_PATTERNS: Record<PowerPointRequestDetection['presentationType'], RegExp[]> = {
  'executive-overview': [
    /executive\s+(?:overview|summary)/i,
    /senior\s+(?:leadership|management)\s+(?:overview|briefing)/i,
    /c-?suite\s+(?:presentation|briefing)/i,
  ],
  'clinical-guidelines': [
    /clinical\s+(?:guideline|protocol|pathway)/i,
    /nice\s+(?:guideline|guidance)/i,
    /treatment\s+(?:protocol|pathway)/i,
    /medical\s+(?:guideline|protocol)/i,
  ],
  'patient-education': [
    /patient\s+(?:education|information|leaflet)/i,
    /health\s+(?:education|literacy)/i,
    /(?:for|to)\s+patients?/i,
  ],
  'training': [
    /training\s+(?:presentation|session|material)/i,
    /(?:staff|team)\s+training/i,
    /(?:onboarding|induction)\s+(?:presentation|training)/i,
    /educational\s+(?:presentation|session)/i,
  ],
  'board-meeting': [
    /board\s+(?:meeting|presentation|report)/i,
    /(?:for|to)\s+(?:the\s+)?board/i,
    /governance\s+(?:presentation|report)/i,
  ],
  'partnership-meeting': [
    /partner(?:ship)?\s+(?:meeting|presentation)/i,
    /(?:for|to)\s+(?:the\s+)?partners?/i,
    /gp\s+partner\s+(?:meeting|presentation)/i,
  ],
  'neighbourhood-meeting': [
    /neighbourhood\s+(?:meeting|presentation)/i,
    /pcn\s+(?:meeting|presentation)/i,
    /primary\s+care\s+network/i,
  ],
  'research': [
    /research\s+(?:presentation|findings|results)/i,
    /(?:study|trial)\s+(?:presentation|results)/i,
    /academic\s+(?:presentation|paper)/i,
  ],
  'general': [],
};

// Slide count extraction pattern
const SLIDE_COUNT_PATTERN = /(\d+)\s*(?:-?\s*)?slides?/i;

/**
 * Detects if a message is requesting PowerPoint generation
 */
export function detectPowerPointRequest(
  message: string,
  previousMessages: { role: string; content: string }[] = [],
  uploadedFiles: UploadedFile[] = []
): PowerPointRequestDetection {
  const messageLower = message.toLowerCase();
  const hasUploadedFiles = uploadedFiles.length > 0;
  
  // Check high-confidence patterns
  let isHighConfidence = HIGH_CONFIDENCE_PATTERNS.some(pattern => pattern.test(message));
  
  // Check medium-confidence patterns
  let isMediumConfidence = !isHighConfidence && MEDIUM_CONFIDENCE_PATTERNS.some(pattern => pattern.test(message));
  
  // Determine confidence level
  let confidence: PowerPointRequestDetection['confidence'] = 'low';
  if (isHighConfidence) {
    confidence = 'high';
  } else if (isMediumConfidence) {
    confidence = 'medium';
  }
  
  // If not a PowerPoint request, return early
  if (confidence === 'low') {
    return {
      isPowerPointRequest: false,
      presentationType: 'general',
      topic: '',
      confidence: 'low',
      useUploadedFiles: false,
    };
  }
  
  // Detect presentation type
  let presentationType: PowerPointRequestDetection['presentationType'] = 'general';
  for (const [type, patterns] of Object.entries(PRESENTATION_TYPE_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(message))) {
      presentationType = type as PowerPointRequestDetection['presentationType'];
      break;
    }
  }
  
  // Extract slide count if specified
  const slideCountMatch = message.match(SLIDE_COUNT_PATTERN);
  const slideCount = slideCountMatch ? parseInt(slideCountMatch[1], 10) : undefined;
  
  // Extract topic from the message
  let topic = extractTopic(message);
  
  // If no topic found but user is referring to previous content, try to extract from previous AI response
  if (!topic && isReferringToPreviousContent(message) && previousMessages.length > 0) {
    const lastAssistantMessage = [...previousMessages].reverse()
      .find(m => m.role === 'assistant' && m.content.length > 100);
    
    if (lastAssistantMessage) {
      topic = extractTopicFromContent(lastAssistantMessage.content);
      console.log('📊 Extracted topic from previous AI response:', topic);
    }
  }
  
  // Check if user wants to use uploaded files
  const useUploadedFiles = hasUploadedFiles && (
    /(?:from|using|based\s+on)\s+(?:the\s+)?(?:uploaded|attached|document|file|report|data)/i.test(message) ||
    /(?:this|these)\s+(?:document|file|report|data)/i.test(message) ||
    /(?:the\s+)?(?:document|file|report|data)\s+(?:I\s+)?(?:uploaded|attached|provided|shared)/i.test(message) ||
    // If they just say "create a presentation" with files attached, assume they want to use them
    (hasUploadedFiles && !topic)
  );
  
  // Extract any custom instructions
  const customInstructions = extractCustomInstructions(message);
  
  return {
    isPowerPointRequest: true,
    presentationType,
    topic: topic || (hasUploadedFiles ? 'Content from uploaded files' : 'General presentation'),
    slideCount: slideCount && slideCount > 0 && slideCount <= 50 ? slideCount : undefined,
    confidence,
    useUploadedFiles: hasUploadedFiles ? useUploadedFiles : false,
    customInstructions,
  };
}

/**
 * Extracts the topic from a PowerPoint request
 */
function extractTopic(message: string): string {
  // Patterns to extract topic - ordered from most specific to least specific
  const topicPatterns = [
    // Explicit "about/on/regarding X" after presentation keyword
    /(?:presentation|power\s*point|pptx?|slides?)\s+(?:about|on|regarding|covering|for)\s+(.+?)(?:\.|$|,\s*(?:using|from|with))/i,
    
    // "ppt on X" or "pptx about X" patterns
    /(?:pptx?)\s+(?:about|on|regarding|for)\s+(.+?)(?:\.|$|,)/i,
    
    // "create/make/generate presentation on/about X"
    /(?:create|generate|make|build|give\s+me)\s+(?:a\s+)?(?:\d+\s*-?\s*slide\s+)?(?:presentation|power\s*point|pptx?|slides?)\s+(?:on|about|for|regarding)\s+(.+?)(?:\.|$)/i,
    
    // "X presentation" pattern - topic before the keyword
    /(?:^|need\s+(?:a\s+)?|want\s+(?:a\s+)?|give\s+me\s+(?:a\s+)?)([A-Z][a-zA-Z0-9\s\-]+?)\s+(?:presentation|power\s*point|pptx?|slides?)(?:\s|$|\.)/i,
    
    // "about/on X" standalone with presentation context nearby
    /(?:about|on|for|regarding)\s+(.+?)(?:\s+presentation|\s+power\s*point|\s+pptx?|\s+slides?|\.|$)/i,
    
    // Direct object after action verb - "create ppt Metformin" or "ppt Metformin"
    /(?:create|generate|make|build|give\s+me)\s+(?:a\s+)?(?:presentation|power\s*point|pptx?|slides?)\s+([A-Z][a-zA-Z0-9\s\-]+?)(?:\.|$|,)/i,
  ];
  
  for (const pattern of topicPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted topic
      let topic = match[1].trim();
      // Remove trailing phrases
      topic = topic.replace(/\s+(?:using|from|with|based)\s+.*$/i, '').trim();
      // Remove common filler words at the start
      topic = topic.replace(/^(?:the|a|an)\s+/i, '').trim();
      if (topic.length > 2 && topic.length < 200) {
        return topic;
      }
    }
  }
  
  // Fallback: Clean the message and extract the likely topic
  let cleanedMessage = message
    .replace(/(?:please\s+)?(?:create|generate|make|build|give\s+me)\s+(?:a\s+)?/gi, '')
    .replace(/(?:power\s*point|pptx?|presentation|slides?)/gi, '')
    .replace(/(?:please|can\s+you|could\s+you|i\s+need|i\s+want)/gi, '')
    .replace(/(?:about|on|for|regarding)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove leading/trailing punctuation
  cleanedMessage = cleanedMessage.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
  
  if (cleanedMessage.length > 2 && cleanedMessage.length < 150) {
    return cleanedMessage;
  }
  
  return '';
}

/**
 * Extracts custom instructions from the message
 */
function extractCustomInstructions(message: string): string | undefined {
  // Look for phrases that indicate special requirements
  const instructionPatterns = [
    /(?:please\s+)?(?:make\s+sure|ensure|include|focus\s+on|emphasise|highlight)\s+(.+?)(?:\.|$)/i,
    /(?:the\s+)?(?:presentation|slides?)\s+should\s+(.+?)(?:\.|$)/i,
    /(?:I\s+)?(?:want|need|would\s+like)\s+(?:the\s+)?(?:presentation|slides?)\s+to\s+(.+?)(?:\.|$)/i,
  ];
  
  const instructions: string[] = [];
  for (const pattern of instructionPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      instructions.push(match[1].trim());
    }
  }
  
  return instructions.length > 0 ? instructions.join('; ') : undefined;
}

/**
 * Gets the display name for a presentation type
 */
export function getPresentationTypeDisplayName(type: PowerPointRequestDetection['presentationType']): string {
  const names: Record<PowerPointRequestDetection['presentationType'], string> = {
    'executive-overview': 'Executive Overview',
    'clinical-guidelines': 'Clinical Guidelines',
    'patient-education': 'Patient Education',
    'training': 'Training Materials',
    'board-meeting': 'Board Meeting',
    'partnership-meeting': 'Partnership Meeting',
    'neighbourhood-meeting': 'Neighbourhood Meeting',
    'research': 'Research Presentation',
    'general': 'General Presentation',
  };
  return names[type] || 'Presentation';
}
