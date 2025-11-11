import { transformMinutesToHtml } from '../lib/minutesTransformCore';

self.onmessage = (e: MessageEvent) => {
  const { content, baseFontSize } = e.data;

  try {
    const html = transformMinutesToHtml(content, baseFontSize);
    self.postMessage({ type: 'success', html });
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error in worker' 
    });
  }
};
