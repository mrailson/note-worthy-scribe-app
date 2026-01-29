/**
 * Conversation Memory Management Utility
 * 
 * This utility optimises conversation history for AI services by:
 * 1. Estimating token counts for messages
 * 2. Summarising older messages when approaching token limits
 * 3. Deduplicating file contents across messages
 * 4. Maintaining context while staying within token limits
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  [key: string]: any;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

// Multimodal content types for vision-capable models
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image_url'; image_url: { url: string } };
type MultimodalContent = TextContent | ImageContent;

interface OptimisedHistory {
  contextSummary: string;
  recentMessages: { role: 'user' | 'assistant' | 'system'; content: string | MultimodalContent[] }[];
  fileContext: string;
  totalTokens: number;
  originalMessageCount: number;
  optimisedMessageCount: number;
  memorySavings: number; // percentage saved
}

/**
 * Check if a file is an image based on its MIME type
 */
function isImageFile(file: UploadedFile): boolean {
  return file.type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name);
}

/**
 * Format image content for multimodal API
 * Handles base64, data URLs, and remote URLs
 */
function formatImageForAPI(file: UploadedFile): ImageContent {
  const content = file.content;
  
  // Already a proper data URL - use as-is
  if (content.startsWith('data:')) {
    return {
      type: 'image_url',
      image_url: { url: content }
    };
  }
  
  // Remote URL (http/https) - the edge function will convert to base64
  // We pass it through as the edge function handles URL-to-base64 conversion
  if (content.startsWith('http://') || content.startsWith('https://')) {
    console.log(`[conversationMemory] Image is a remote URL, passing through for server-side conversion: ${file.name}`);
    return {
      type: 'image_url',
      image_url: { url: content }
    };
  }
  
  // Raw base64 without data: prefix - add it
  const mimeType = file.type || 'image/jpeg';
  return {
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${content}` }
  };
}

/**
 * Estimate token count for a string
 * Rough approximation: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for a message including files
 */
export function estimateMessageTokens(message: Message): number {
  let tokens = estimateTokens(message.content);
  
  if (message.files) {
    for (const file of message.files) {
      // File content adds significant tokens
      tokens += estimateTokens(file.content);
      // File metadata adds a small amount
      tokens += estimateTokens(file.name) + 10;
    }
  }
  
  return tokens;
}

/**
 * Extract key topics and entities from a message for summary
 */
function extractKeyPoints(content: string): string[] {
  const keyPoints: string[] = [];
  
  // Extract questions (lines ending with ?)
  const questions = content.match(/[^.!?\n]*\?/g) || [];
  keyPoints.push(...questions.slice(0, 2).map(q => q.trim()));
  
  // Extract key phrases (capitalized terms, medical terms, etc.)
  const importantPhrases = content.match(/(?:NHS|NICE|CQC|QOF|PCN|GP|Dr\.?|patient|clinical|policy|protocol|compliance|audit|training|budget|staff|referral|prescription|medication)/gi) || [];
  const uniquePhrases = [...new Set(importantPhrases.map(p => p.toLowerCase()))];
  
  // Extract any numbered items or bullet points
  const listItems = content.match(/^\s*(?:\d+\.|[-•*])\s*.+$/gm) || [];
  keyPoints.push(...listItems.slice(0, 3).map(item => item.trim()));
  
  return keyPoints.slice(0, 5);
}

/**
 * Create a concise summary of a conversation exchange
 */
function summariseExchange(userMessage: Message, assistantMessage: Message): string {
  const userKeyPoints = extractKeyPoints(userMessage.content);
  const topic = userKeyPoints.length > 0 
    ? userKeyPoints[0].slice(0, 100) 
    : userMessage.content.slice(0, 100);
  
  // Extract the main action/answer from assistant
  const assistantContent = assistantMessage.content;
  const firstParagraph = assistantContent.split('\n\n')[0] || assistantContent.slice(0, 150);
  
  // Check for file context
  const fileContext = userMessage.files?.length 
    ? ` [Files: ${userMessage.files.map(f => f.name).join(', ')}]` 
    : '';
  
  return `Q: ${topic}${fileContext} → A: ${firstParagraph.slice(0, 150)}...`;
}

/**
 * Extract and deduplicate file information from messages
 */
function extractFileContext(messages: Message[]): { fileContext: string; fileNames: Set<string> } {
  const fileNames = new Set<string>();
  const fileDetails: string[] = [];
  
  for (const msg of messages) {
    if (msg.files) {
      for (const file of msg.files) {
        if (!fileNames.has(file.name)) {
          fileNames.add(file.name);
          // Only include file metadata, not full content
          fileDetails.push(`- ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)`);
        }
      }
    }
  }
  
  if (fileDetails.length === 0) return { fileContext: '', fileNames };
  
  return {
    fileContext: `\n\nFiles referenced in this conversation:\n${fileDetails.join('\n')}`,
    fileNames
  };
}

/**
 * Main function to optimise conversation history for API calls
 * 
 * @param messages - Full conversation history
 * @param maxTokens - Maximum tokens to use (default 30000, leaving room for system prompt and response)
 * @param recentMessageCount - Number of recent messages to keep in full (default 15)
 * @returns Optimised history ready for API call
 */
export function optimiseConversationHistory(
  messages: Message[],
  maxTokens: number = 30000,
  recentMessageCount: number = 15
): OptimisedHistory {
  if (messages.length === 0) {
    return {
      contextSummary: '',
      recentMessages: [],
      fileContext: '',
      totalTokens: 0,
      originalMessageCount: 0,
      optimisedMessageCount: 0,
      memorySavings: 0
    };
  }

  // Calculate original token count
  const originalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  
  // If we're under the limit, just format and return all messages
  if (originalTokens < maxTokens && messages.length <= recentMessageCount) {
    const { fileContext, fileNames } = extractFileContext(messages);
    
    const formattedMessages = messages.map(msg => {
      // Check if this message has image files that need multimodal formatting
      const hasImages = msg.role === 'user' && msg.files?.some(isImageFile);
      
      if (hasImages && msg.files) {
        // Build multimodal content array
        const contentParts: MultimodalContent[] = [];
        
        // Add the text content first
        if (msg.content.trim()) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        
        // Add each file (images as image_url, others as text)
        for (const file of msg.files) {
          if (isImageFile(file)) {
            contentParts.push(formatImageForAPI(file));
          } else {
            // Non-image files as text
            contentParts.push({
              type: 'text',
              text: `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
            });
          }
        }
        
        return { role: msg.role, content: contentParts };
      }
      
      // No images - use string content
      let content = msg.content;
      
      // Include non-image file content for user messages
      if (msg.role === 'user' && msg.files && msg.files.length > 0) {
        const fileContents = msg.files
          .filter(file => !isImageFile(file))
          .map(file => `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`)
          .join('');
        content += fileContents;
      }
      
      return { role: msg.role, content };
    });
    
    return {
      contextSummary: '',
      recentMessages: formattedMessages,
      fileContext,
      totalTokens: originalTokens,
      originalMessageCount: messages.length,
      optimisedMessageCount: messages.length,
      memorySavings: 0
    };
  }

  // We need to optimise - split messages into old and recent
  const recentCount = Math.min(recentMessageCount, messages.length);
  const oldMessages = messages.slice(0, -recentCount);
  const recentMessages = messages.slice(-recentCount);
  
  // Create summaries of older message exchanges
  const summaries: string[] = [];
  
  for (let i = 0; i < oldMessages.length; i += 2) {
    const userMsg = oldMessages[i];
    const assistantMsg = oldMessages[i + 1];
    
    if (userMsg && userMsg.role === 'user') {
      if (assistantMsg && assistantMsg.role === 'assistant') {
        summaries.push(summariseExchange(userMsg, assistantMsg));
      } else {
        // Orphan user message
        const keyPoints = extractKeyPoints(userMsg.content);
        summaries.push(`Q: ${keyPoints[0] || userMsg.content.slice(0, 100)}...`);
      }
    }
  }
  
  // Extract file context from all messages (but only include content from recent ones)
  const { fileContext, fileNames } = extractFileContext(messages);
  
  // Build context summary
  let contextSummary = '';
  if (summaries.length > 0) {
    contextSummary = `[CONVERSATION CONTEXT - ${summaries.length} earlier exchanges summarised]\n${summaries.join('\n')}\n[END CONTEXT]`;
  }
  
  // Format recent messages, including file content only for files not already mentioned
  const includedFiles = new Set<string>();
  const formattedRecentMessages = recentMessages.map(msg => {
    // Check if this message has image files that need multimodal formatting
    const hasImages = msg.role === 'user' && msg.files?.some(isImageFile);
    
    if (hasImages && msg.files) {
      // Build multimodal content array
      const contentParts: MultimodalContent[] = [];
      
      // Add the text content first
      let textContent = msg.content;
      
      // Add reference to previously uploaded non-image files
      const referencedFiles = msg.files
        .filter(file => !isImageFile(file) && includedFiles.has(file.name))
        .map(file => file.name);
      
      if (referencedFiles.length > 0) {
        textContent += `\n\n[Referencing previously uploaded files: ${referencedFiles.join(', ')}]`;
      }
      
      if (textContent.trim()) {
        contentParts.push({ type: 'text', text: textContent });
      }
      
      // Add each file (images as image_url, others as text)
      for (const file of msg.files) {
        if (isImageFile(file)) {
          contentParts.push(formatImageForAPI(file));
          includedFiles.add(file.name);
        } else if (!includedFiles.has(file.name)) {
          // Non-image files as text (only if not already included)
          includedFiles.add(file.name);
          contentParts.push({
            type: 'text',
            text: `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
          });
        }
      }
      
      return { role: msg.role, content: contentParts };
    }
    
    // No images - use string content
    let content = msg.content;
    
    // Only include non-image file content if we haven't included it before
    if (msg.role === 'user' && msg.files && msg.files.length > 0) {
      const newFileContents = msg.files
        .filter(file => !isImageFile(file) && !includedFiles.has(file.name))
        .map(file => {
          includedFiles.add(file.name);
          return `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`;
        })
        .join('');
      
      // For files already included, just reference them
      const referencedNonImageFiles = msg.files
        .filter(file => !isImageFile(file) && includedFiles.has(file.name) && !newFileContents.includes(file.name))
        .map(file => file.name);
      
      if (referencedNonImageFiles.length > 0) {
        content += `\n\n[Referencing previously uploaded files: ${referencedNonImageFiles.join(', ')}]`;
      }
      
      content += newFileContents;
    }
    
    return { role: msg.role, content };
  });
  
  // Calculate new token count (handle both string and multimodal content)
  const contextTokens = estimateTokens(contextSummary);
  const recentTokens = formattedRecentMessages.reduce((sum, msg) => {
    if (typeof msg.content === 'string') {
      return sum + estimateTokens(msg.content);
    }
    // For multimodal, only count text parts (images are separate)
    return sum + msg.content
      .filter((part): part is TextContent => part.type === 'text')
      .reduce((s, p) => s + estimateTokens(p.text), 0);
  }, 0);
  const fileContextTokens = estimateTokens(fileContext);
  const totalTokens = contextTokens + recentTokens + fileContextTokens;
  
  // If still over limit, truncate the context summary
  if (totalTokens > maxTokens) {
    const excessTokens = totalTokens - maxTokens;
    const charsToRemove = excessTokens * 4;
    
    if (contextSummary.length > charsToRemove) {
      // Keep the start and truncate
      const keepChars = Math.max(500, contextSummary.length - charsToRemove);
      contextSummary = contextSummary.slice(0, keepChars) + '\n[Earlier context truncated due to length...]';
    }
  }
  
  const memorySavings = originalTokens > 0 
    ? Math.round((1 - (totalTokens / originalTokens)) * 100) 
    : 0;
  
  return {
    contextSummary,
    recentMessages: formattedRecentMessages,
    fileContext,
    totalTokens,
    originalMessageCount: messages.length,
    optimisedMessageCount: recentMessages.length,
    memorySavings: Math.max(0, memorySavings)
  };
}

/**
 * Prepare messages for API call with conversation context
 * Returns messages in a format compatible with vision-capable models
 */
export function prepareMessagesForAPI(
  messages: Message[],
  systemPrompt: string,
  maxTokens: number = 30000
): { role: 'user' | 'assistant' | 'system'; content: string | MultimodalContent[] }[] {
  const optimised = optimiseConversationHistory(messages, maxTokens);
  
  // Build enhanced system prompt with context
  let enhancedSystemPrompt = systemPrompt;
  
  if (optimised.contextSummary) {
    enhancedSystemPrompt += `\n\n${optimised.contextSummary}`;
  }
  
  if (optimised.fileContext) {
    enhancedSystemPrompt += optimised.fileContext;
  }
  
  // Log memory stats for debugging
  const hasImageContent = optimised.recentMessages.some(m => Array.isArray(m.content));
  console.log('📊 Conversation Memory Stats:', {
    originalMessages: optimised.originalMessageCount,
    optimisedMessages: optimised.optimisedMessageCount,
    totalTokens: optimised.totalTokens,
    memorySavings: `${optimised.memorySavings}%`,
    hasContextSummary: !!optimised.contextSummary,
    hasImageContent
  });
  
  return [
    { role: 'system' as const, content: enhancedSystemPrompt },
    ...optimised.recentMessages
  ];
}

/**
 * Get memory usage statistics for the current conversation
 */
export function getMemoryStats(messages: Message[]): {
  messageCount: number;
  estimatedTokens: number;
  tokenPercentage: number;
  isApproachingLimit: boolean;
  recommendation: string | null;
} {
  const MAX_SAFE_TOKENS = 30000;
  const WARNING_THRESHOLD = 0.7; // 70%
  
  const totalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  const tokenPercentage = totalTokens / MAX_SAFE_TOKENS;
  const isApproachingLimit = tokenPercentage >= WARNING_THRESHOLD;
  
  let recommendation: string | null = null;
  if (tokenPercentage >= 0.9) {
    recommendation = 'Consider starting a new conversation to maintain response quality.';
  } else if (tokenPercentage >= 0.7) {
    recommendation = 'Conversation history is getting long. Older messages will be summarised automatically.';
  }
  
  return {
    messageCount: messages.length,
    estimatedTokens: totalTokens,
    tokenPercentage: Math.round(tokenPercentage * 100),
    isApproachingLimit,
    recommendation
  };
}
