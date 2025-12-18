/**
 * Web Worker for formatting meeting minutes
 * Offloads heavy regex processing from the main thread
 */

import { transformMinutesToHtml } from '../utils/minutesTransformCore';

// Types for messages
interface FormatRequest {
  type: 'format';
  content: string;
  baseFontSize: number;
  requestId: string;
}

interface FormatResponse {
  type: 'formatted';
  html: string;
  requestId: string;
  success: boolean;
  error?: string;
}

// Handle incoming messages
self.onmessage = (event: MessageEvent<FormatRequest>) => {
  const { type, content, baseFontSize, requestId } = event.data;

  if (type === 'format') {
    try {
      console.log('[Worker] Starting format for request:', requestId, 'content length:', content.length);
      const startTime = performance.now();
      
      const html = transformMinutesToHtml(content, baseFontSize);
      
      const endTime = performance.now();
      console.log('[Worker] Format complete in', (endTime - startTime).toFixed(0), 'ms');

      const response: FormatResponse = {
        type: 'formatted',
        html,
        requestId,
        success: true
      };
      self.postMessage(response);
    } catch (error) {
      console.error('[Worker] Error formatting minutes:', error);
      const response: FormatResponse = {
        type: 'formatted',
        html: '',
        requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      self.postMessage(response);
    }
  }
};

// Export for TypeScript module resolution
export {};
