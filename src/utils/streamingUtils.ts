/**
 * Memory-safe streaming utilities for AI4GP
 * Prevents memory leaks from untracked timeouts and unbounded content
 */

export interface StreamController {
  abort: () => void;
  isAborted: () => boolean;
}

/**
 * Creates a cancellable streaming text display
 * Returns a controller that can be used to abort streaming
 */
export function createStreamController(): StreamController {
  let aborted = false;
  const timeoutIds: NodeJS.Timeout[] = [];
  
  return {
    abort: () => {
      aborted = true;
      // Clear all pending timeouts
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds.length = 0;
    },
    isAborted: () => aborted
  };
}

/**
 * Streams text content word by word with proper cleanup
 */
export function streamText(
  fullContent: string,
  onChunk: (accumulatedContent: string, isComplete: boolean) => void,
  options: {
    chunkSize?: number;
    delayMs?: number;
    controller?: StreamController;
  } = {}
): StreamController {
  const { chunkSize = 5, delayMs = 15, controller = createStreamController() } = options;
  
  const chunks = fullContent.split(' ');
  const actualChunkSize = Math.max(3, Math.floor(chunks.length / Math.min(8, chunks.length)));
  let currentIndex = 0;
  let accumulatedContent = '';
  let timeoutId: NodeJS.Timeout | null = null;

  const processChunk = () => {
    if (controller.isAborted()) {
      return;
    }

    if (currentIndex < chunks.length) {
      const endIndex = Math.min(currentIndex + actualChunkSize, chunks.length);
      const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
      accumulatedContent += chunkText;
      currentIndex = endIndex;

      onChunk(accumulatedContent.trim(), currentIndex >= chunks.length);

      if (currentIndex < chunks.length) {
        timeoutId = setTimeout(processChunk, delayMs + Math.random() * 10);
      }
    }
  };

  // Start streaming
  processChunk();

  return controller;
}

/**
 * Strips heavy content from messages to reduce memory usage
 * Call this before storing messages in state for long periods
 * 
 * Thresholds reduced for more aggressive memory management:
 * - File content: 2000 chars (was 5000)
 * - Image data: 10000 chars (was 50000)
 */
export function stripHeavyContentFromMessage(message: any): any {
  const stripped = { ...message };
  
  // Strip base64 audio content
  if (stripped.generatedAudio?.audioContent) {
    stripped.generatedAudio = {
      ...stripped.generatedAudio,
      audioContent: '[STRIPPED_FOR_MEMORY]',
      wasStripped: true
    };
  }
  
  // Strip large file contents more aggressively (keep metadata)
  if (stripped.files?.length > 0) {
    stripped.files = stripped.files.map((file: any) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      isLoading: false,
      metadata: file.metadata,
      content: file.content?.length > 2000 ? '[STRIPPED_FOR_MEMORY]' : file.content,
      wasStripped: file.content?.length > 2000
    }));
  }
  
  // Strip large base64 images from generatedImages more aggressively
  if (stripped.generatedImages?.length > 0) {
    stripped.generatedImages = stripped.generatedImages.map((img: any) => ({
      ...img,
      // Keep URL references but strip inline base64
      imageData: img.imageData?.startsWith('data:') && img.imageData.length > 10000 
        ? '[STRIPPED_FOR_MEMORY]' 
        : img.imageData,
      wasStripped: img.imageData?.startsWith('data:') && img.imageData.length > 10000
    }));
  }
  
  // Strip presentation base64 data
  if (stripped.generatedPresentation?.pptxBase64) {
    stripped.generatedPresentation = {
      ...stripped.generatedPresentation,
      pptxBase64: '[STRIPPED_FOR_MEMORY]',
      wasStripped: true
    };
  }
  
  return stripped;
}

/**
 * Optimises an array of messages for memory by stripping heavy content from older messages
 */
export function optimiseMessagesForMemory(messages: any[], keepRecentCount: number = 10): any[] {
  return messages.map((msg, index) => {
    // Keep recent messages fully intact
    if (index >= messages.length - keepRecentCount) {
      return msg;
    }
    // Strip heavy content from older messages
    return stripHeavyContentFromMessage(msg);
  });
}
