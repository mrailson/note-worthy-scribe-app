import { UploadedFile } from '@/types/ai4gp';

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
  const topic = extractTopic(message);
  
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
  // Patterns to extract topic
  const topicPatterns = [
    /(?:presentation|power\s*point|slides?)\s+(?:about|on|regarding|covering)\s+(.+?)(?:\.|$|,\s*(?:using|from|with))/i,
    /(?:presentation|power\s*point|slides?)\s+for\s+(.+?)(?:\.|$|,\s*(?:using|from|with))/i,
    /(?:create|generate|make)\s+(?:a\s+)?(?:\d+\s*-?\s*slide\s+)?(?:presentation|power\s*point)\s+(?:about|on)\s+(.+?)(?:\.|$)/i,
    /(?:about|on|regarding|covering)\s+(.+?)(?:\s+using|\s+from|\s+with|\.|$)/i,
  ];
  
  for (const pattern of topicPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted topic
      let topic = match[1].trim();
      // Remove trailing phrases
      topic = topic.replace(/\s+(?:using|from|with|based)\s+.*$/i, '').trim();
      if (topic.length > 3 && topic.length < 200) {
        return topic;
      }
    }
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
