/**
 * iOS Chunk Timer Web Worker
 * 
 * This worker provides reliable timing for audio chunk processing on iOS.
 * Web Workers are more resistant to background throttling than main thread timers.
 * 
 * Messages:
 * - { type: 'start', intervalMs: number } - Start the timer
 * - { type: 'stop' } - Stop the timer
 * - { type: 'ping' } - Check if worker is alive
 * 
 * Outgoing messages:
 * - { type: 'tick', timestamp: number } - Timer tick
 * - { type: 'pong' } - Response to ping
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

self.onmessage = (event: MessageEvent) => {
  const { type, intervalMs } = event.data;

  switch (type) {
    case 'start':
      // Clear any existing interval
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      tickCount = 0;
      const interval = intervalMs || 15000; // Default 15 seconds
      
      console.log(`[iOS Timer Worker] Starting with ${interval}ms interval`);
      
      intervalId = setInterval(() => {
        tickCount++;
        self.postMessage({ 
          type: 'tick', 
          timestamp: Date.now(),
          tickCount 
        });
      }, interval);
      
      // Send immediate first tick
      self.postMessage({ 
        type: 'tick', 
        timestamp: Date.now(),
        tickCount: 0,
        isInitial: true
      });
      break;

    case 'stop':
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log(`[iOS Timer Worker] Stopped after ${tickCount} ticks`);
      }
      tickCount = 0;
      break;

    case 'ping':
      self.postMessage({ type: 'pong', timestamp: Date.now() });
      break;

    case 'forceProcess':
      // Immediately send a tick to trigger processing
      self.postMessage({ 
        type: 'tick', 
        timestamp: Date.now(),
        tickCount: ++tickCount,
        isForced: true
      });
      break;

    default:
      console.warn(`[iOS Timer Worker] Unknown message type: ${type}`);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
