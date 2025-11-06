/**
 * AudioFocusManager - Manages audio device switching and mic coordination
 * 
 * This singleton helps prevent audio glitches that occur when browsers switch
 * between audio profiles (e.g., Bluetooth HFP → A2DP) by coordinating microphone
 * sessions with audio playback.
 */

interface MicSource {
  id: string;
  pause: () => Promise<void> | void;
  resume?: () => Promise<void> | void;
}

class AudioFocusManager {
  private static instance: AudioFocusManager;
  private micSources: Map<string, MicSource> = new Map();
  private readonly DEBUG = true;

  private constructor() {
    if (this.DEBUG) {
      console.log('[AudioFocus] Manager initialized');
    }
  }

  static getInstance(): AudioFocusManager {
    if (!AudioFocusManager.instance) {
      AudioFocusManager.instance = new AudioFocusManager();
    }
    return AudioFocusManager.instance;
  }

  /**
   * Register a microphone source that can be paused during audio playback
   */
  register(id: string, pause: () => Promise<void> | void, resume?: () => Promise<void> | void): void {
    this.micSources.set(id, { id, pause, resume });
    if (this.DEBUG) {
      console.log(`[AudioFocus] Registered mic source: ${id} (total: ${this.micSources.size})`);
    }
  }

  /**
   * Unregister a microphone source
   */
  unregister(id: string): void {
    const existed = this.micSources.delete(id);
    if (this.DEBUG && existed) {
      console.log(`[AudioFocus] Unregistered mic source: ${id} (remaining: ${this.micSources.size})`);
    }
  }

  /**
   * Pause all registered microphone sources
   */
  async pauseAll(reason: string = 'audio_playback'): Promise<void> {
    if (this.micSources.size === 0) {
      if (this.DEBUG) {
        console.log(`[AudioFocus] No mic sources to pause for: ${reason}`);
      }
      return;
    }

    if (this.DEBUG) {
      console.log(`[AudioFocus] Pausing ${this.micSources.size} mic source(s) for: ${reason}`);
    }

    const pausePromises = Array.from(this.micSources.values()).map(async (source) => {
      try {
        await source.pause();
        if (this.DEBUG) {
          console.log(`[AudioFocus] ✓ Paused: ${source.id}`);
        }
      } catch (error) {
        console.error(`[AudioFocus] ✗ Failed to pause ${source.id}:`, error);
      }
    });

    await Promise.allSettled(pausePromises);
  }

  /**
   * Resume all registered microphone sources
   */
  async resumeAll(): Promise<void> {
    if (this.micSources.size === 0) {
      if (this.DEBUG) {
        console.log('[AudioFocus] No mic sources to resume');
      }
      return;
    }

    if (this.DEBUG) {
      console.log(`[AudioFocus] Resuming ${this.micSources.size} mic source(s)`);
    }

    const resumePromises = Array.from(this.micSources.values()).map(async (source) => {
      if (source.resume) {
        try {
          await source.resume();
          if (this.DEBUG) {
            console.log(`[AudioFocus] ✓ Resumed: ${source.id}`);
          }
        } catch (error) {
          console.error(`[AudioFocus] ✗ Failed to resume ${source.id}:`, error);
        }
      }
    });

    await Promise.allSettled(resumePromises);
  }

  /**
   * Get count of active microphone sources
   */
  getActiveSourceCount(): number {
    return this.micSources.size;
  }
}

/**
 * Play a silent audio buffer to "warm up" the audio output device
 * This prevents glitches when switching from mic input to audio playback
 */
export async function playoutSilentPreRoll(durationMs: number = 500): Promise<void> {
  console.log(`[AudioFocus] Playing ${durationMs}ms silent pre-roll to warm up audio device`);
  
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext({ sampleRate: 48000 });
    
    // Create silent buffer
    const durationSec = durationMs / 1000;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * durationSec), ctx.sampleRate);
    
    // Buffer is already silent (zeros), no need to fill
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    
    // Wait for silent audio to complete
    await new Promise(resolve => setTimeout(resolve, durationMs + 50));
    
    // Clean up
    await ctx.close();
    console.log('[AudioFocus] ✓ Silent pre-roll completed');
  } catch (error) {
    console.warn('[AudioFocus] Silent pre-roll failed (non-critical):', error);
  }
}

/**
 * Smoothly fade in audio volume from 0 to target over specified duration
 */
export function fadeInVolume(
  audioElement: HTMLAudioElement,
  targetVolume: number = 1,
  durationMs: number = 400
): void {
  const startVolume = 0;
  const startTime = performance.now();
  
  audioElement.volume = startVolume;
  
  const fadeStep = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    
    // Ease-in-out curve for smooth fade
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    audioElement.volume = startVolume + (targetVolume - startVolume) * eased;
    
    if (progress < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      console.log('[AudioFocus] ✓ Volume fade-in completed');
    }
  };
  
  requestAnimationFrame(fadeStep);
}

export const audioFocusManager = AudioFocusManager.getInstance();
