/**
 * Utility to detect when users are requesting visual/pictorial content
 * and extract context for image generation
 */

export interface ImageRequestDetection {
  isImageRequest: boolean;
  imagePrompt: string;
  requestType: 'chart' | 'diagram' | 'infographic' | 'calendar' | 'poster' | 'general';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detects if a user message is requesting visual/pictorial content
 */
export function detectImageRequest(message: string): ImageRequestDetection {
  const lowerMessage = message.toLowerCase().trim();
  
  // High-confidence image request keywords
  const highConfidenceKeywords = [
    'pictorially', 'picture', 'visual representation', 'visualise', 'visualize',
    'create an image', 'generate an image', 'make an image', 'show me visually',
    'create a poster', 'make a poster', 'design a poster', 'generate a poster',
    'create a diagram', 'make a diagram', 'draw a diagram',
    'create an infographic', 'make an infographic', 'design an infographic',
    'create a chart', 'make a chart', 'generate a chart',
    'create a visual', 'provide that pictorially', 'show that pictorially',
    'illustrate this', 'draw this', 'image of', 'picture of'
  ];
  
  // Medium-confidence keywords (need more context)
  const mediumConfidenceKeywords = [
    'visually', 'graphic', 'illustration', 'show me',
    'calendar view', 'visual calendar', 'graphical',
    'flowchart', 'flow chart', 'mind map', 'timeline'
  ];
  
  // Request type detection
  const chartKeywords = ['chart', 'graph', 'bar chart', 'pie chart', 'line graph', 'data visual'];
  const diagramKeywords = ['diagram', 'flowchart', 'flow chart', 'mind map', 'process flow', 'structure'];
  const infographicKeywords = ['infographic', 'info graphic', 'data graphic', 'visual summary'];
  const calendarKeywords = ['calendar', 'schedule', 'timeline', 'timetable', 'rota', 'leave chart'];
  const posterKeywords = ['poster', 'flyer', 'banner', 'sign', 'notice', 'announcement'];
  
  // Check for high-confidence matches
  const isHighConfidence = highConfidenceKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Check for medium-confidence matches
  const isMediumConfidence = mediumConfidenceKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Determine if this is an image request
  const isImageRequest = isHighConfidence || isMediumConfidence;
  
  if (!isImageRequest) {
    return {
      isImageRequest: false,
      imagePrompt: '',
      requestType: 'general',
      confidence: 'low'
    };
  }
  
  // Determine request type
  let requestType: ImageRequestDetection['requestType'] = 'general';
  
  if (chartKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'chart';
  } else if (diagramKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'diagram';
  } else if (infographicKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'infographic';
  } else if (calendarKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'calendar';
  } else if (posterKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'poster';
  }
  
  return {
    isImageRequest: true,
    imagePrompt: message, // Original message becomes base prompt
    requestType,
    confidence: isHighConfidence ? 'high' : 'medium'
  };
}

/**
 * Extracts conversation context for image generation
 * Looks at previous messages to understand what should be visualised
 */
export function extractImageContext(
  currentMessage: string,
  previousMessages: { role: string; content: string }[],
  maxContextMessages: number = 5
): string {
  // Get recent messages for context
  const recentMessages = previousMessages.slice(-maxContextMessages);
  
  // Build context string
  const contextParts: string[] = [];
  
  for (const msg of recentMessages) {
    if (msg.role === 'assistant') {
      // Extract key information from assistant responses
      // Look for structured content that could be visualised
      const content = msg.content;
      
      // Check for tables, lists, or structured data
      if (content.includes('|') || content.includes('- ') || content.includes('* ')) {
        contextParts.push(`Previous content to visualise:\n${content.substring(0, 2000)}`);
      }
    }
  }
  
  // Combine with current message
  const fullContext = [
    currentMessage,
    ...contextParts
  ].join('\n\n---\n\n');
  
  return fullContext;
}

/**
 * Determines if the image request refers to previous content
 * e.g., "please provide that pictorially" refers to the previous response
 */
export function isReferringToPreviousContent(message: string): boolean {
  const referenceKeywords = [
    'that', 'this', 'above', 'previous', 'the information',
    'the data', 'the content', 'what you said', 'your response',
    'the schedule', 'the calendar', 'the list', 'the table'
  ];
  
  const lowerMessage = message.toLowerCase();
  
  return referenceKeywords.some(keyword => lowerMessage.includes(keyword));
}
