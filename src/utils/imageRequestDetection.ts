/**
 * Utility to detect when users are requesting visual/pictorial content
 * and extract context for image generation
 */

export interface ImageRequestDetection {
  isImageRequest: boolean;
  imagePrompt: string;
  requestType: 'chart' | 'diagram' | 'infographic' | 'calendar' | 'poster' | 'logo' | 'general';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detects if a user message is requesting visual/pictorial content
 */
export function detectImageRequest(message: string, previousMessages?: { role: string; content: string }[]): ImageRequestDetection {
  const lowerMessage = message.toLowerCase().trim();
  
  // High-confidence image request keywords
  const highConfidenceKeywords = [
    'pictorially', 'picture', 'visual representation', 'visualise', 'visualize',
    'create an image', 'generate an image', 'make an image', 'show me visually',
    'create a poster', 'make a poster', 'design a poster', 'generate a poster',
    'create a logo', 'make a logo', 'design a logo', 'generate a logo', 'logo for',
    'create a diagram', 'make a diagram', 'draw a diagram',
    'create an infographic', 'make an infographic', 'design an infographic',
    'create a chart', 'make a chart', 'generate a chart',
    'create a visual', 'provide that pictorially', 'show that pictorially',
    'illustrate this', 'draw this', 'image of', 'picture of',
    'as an image', 'as a picture', 'turn into image', 'turn into a picture',
    'make it visual', 'make this visual', 'show as image', 'display as image',
    'create leave calendar image', 'generate leave calendar', 'leave calendar picture',
    'as a visual', 'in picture form', 'in image form', 'in visual form',
    'create a picture', 'make a picture', 'show pictorially', 'display pictorially',
    'convert to image', 'convert to picture', 'turn this into', 'make this into an image'
  ];
  
  // Medium-confidence keywords (need more context)
  const mediumConfidenceKeywords = [
    'visually', 'graphic', 'illustration', 'show me',
    'calendar view', 'visual calendar', 'graphical',
    'flowchart', 'flow chart', 'mind map', 'timeline',
    'poster for', 'banner for', 'notice for', 'sign for'
  ];

  // Follow-up phrases that indicate user wants the AI to generate an image
  // when previous context was about images
  const followUpImagePhrases = [
    'can you do it', 'can you make it', 'can you create it', 'can you generate it',
    'please do it', 'please make it', 'please create it', 'please generate it',
    'do it', 'make it', 'create it', 'generate it', 'go ahead', 'yes please',
    'yes do it', 'yes make it', 'yes create it', 'try it', 'give it a go'
  ];
  
  // Request type detection
  const chartKeywords = ['chart', 'graph', 'bar chart', 'pie chart', 'line graph', 'data visual'];
  const diagramKeywords = ['diagram', 'flowchart', 'flow chart', 'mind map', 'process flow', 'structure'];
  const infographicKeywords = ['infographic', 'info graphic', 'data graphic', 'visual summary'];
  const calendarKeywords = ['calendar', 'schedule', 'timeline', 'timetable', 'rota', 'leave chart', 'leave calendar'];
  const posterKeywords = ['poster', 'flyer', 'banner', 'sign', 'notice', 'announcement'];
  const logoKeywords = ['logo', 'brand mark', 'emblem', 'badge', 'practice symbol', 'company logo'];
  
  // Check for high-confidence matches
  const isHighConfidence = highConfidenceKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Check for medium-confidence matches
  const isMediumConfidence = mediumConfidenceKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Check for follow-up phrases when previous context was about images
  let isFollowUpToImageRequest = false;
  if (previousMessages && previousMessages.length > 0) {
    const isFollowUp = followUpImagePhrases.some(phrase => lowerMessage.includes(phrase));
    
    if (isFollowUp) {
      // Check if previous AI response mentioned it can't create images or suggested external tools
      const lastAssistantMessage = [...previousMessages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage) {
        const assistantContent = lastAssistantMessage.content.toLowerCase();
        const mentionedImageLimitation = 
          assistantContent.includes("can't create visual") ||
          assistantContent.includes("cannot create visual") ||
          assistantContent.includes("can't create image") ||
          assistantContent.includes("cannot create image") ||
          assistantContent.includes("can't generate image") ||
          assistantContent.includes("cannot generate image") ||
          assistantContent.includes("unable to create image") ||
          assistantContent.includes("unable to generate image") ||
          assistantContent.includes("graphic design tool") ||
          assistantContent.includes("canva") ||
          assistantContent.includes("microsoft word") ||
          assistantContent.includes("powerpoint") ||
          assistantContent.includes("design tool") ||
          assistantContent.includes("use a tool");
        
        if (mentionedImageLimitation) {
          isFollowUpToImageRequest = true;
        }
      }
      
      // Also check if previous user message was about images
      const lastUserMessage = [...previousMessages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        const userContent = lastUserMessage.content.toLowerCase();
        const wasAskingForImage = 
          highConfidenceKeywords.some(k => userContent.includes(k)) ||
          mediumConfidenceKeywords.some(k => userContent.includes(k));
        
        if (wasAskingForImage) {
          isFollowUpToImageRequest = true;
        }
      }
    }
  }
  
  // Determine if this is an image request
  const isImageRequest = isHighConfidence || isMediumConfidence || isFollowUpToImageRequest;
  
  if (!isImageRequest) {
    return {
      isImageRequest: false,
      imagePrompt: '',
      requestType: 'general',
      confidence: 'low'
    };
  }
  
  // Determine request type from current message or previous context
  let requestType: ImageRequestDetection['requestType'] = 'general';
  
  // Check current message first
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
  } else if (logoKeywords.some(k => lowerMessage.includes(k))) {
    requestType = 'logo';
  } else if (previousMessages && previousMessages.length > 0) {
    // Check previous context for request type
    const recentContext = previousMessages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
    if (chartKeywords.some(k => recentContext.includes(k))) {
      requestType = 'chart';
    } else if (diagramKeywords.some(k => recentContext.includes(k))) {
      requestType = 'diagram';
    } else if (calendarKeywords.some(k => recentContext.includes(k))) {
      requestType = 'calendar';
    } else if (posterKeywords.some(k => recentContext.includes(k))) {
      requestType = 'poster';
    } else if (infographicKeywords.some(k => recentContext.includes(k))) {
      requestType = 'infographic';
    } else if (logoKeywords.some(k => recentContext.includes(k))) {
      requestType = 'logo';
    }
  }
  
  // Build the image prompt from context if this is a follow-up
  let imagePrompt = message;
  if (isFollowUpToImageRequest && previousMessages) {
    // Find the original image request from user
    const recentUserMessages = previousMessages.filter(m => m.role === 'user').slice(-3);
    for (const userMsg of recentUserMessages.reverse()) {
      const content = userMsg.content.toLowerCase();
      if (highConfidenceKeywords.some(k => content.includes(k)) || 
          mediumConfidenceKeywords.some(k => content.includes(k))) {
        imagePrompt = userMsg.content;
        break;
      }
    }
  }
  
  return {
    isImageRequest: true,
    imagePrompt,
    requestType,
    confidence: isHighConfidence ? 'high' : (isFollowUpToImageRequest ? 'high' : 'medium')
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
      const content = msg.content;
      
      // Always include assistant content for context (truncated)
      contextParts.push(`Previous AI response:\n${content.substring(0, 2500)}`);
    } else if (msg.role === 'user') {
      // Include user messages for context
      contextParts.push(`User request:\n${msg.content.substring(0, 500)}`);
    }
  }
  
  // Combine with current message
  const fullContext = [
    `Current request: ${currentMessage}`,
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
    'the schedule', 'the calendar', 'the list', 'the table',
    'do it', 'make it', 'create it', 'generate it', 'can you'
  ];
  
  const lowerMessage = message.toLowerCase();
  
  return referenceKeywords.some(keyword => lowerMessage.includes(keyword));
}
