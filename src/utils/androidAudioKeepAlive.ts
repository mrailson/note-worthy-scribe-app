/**
 * Android Audio Keep-Alive
 * 
 * Plays an inaudible tone to prevent Android browsers from suspending the AudioContext
 * when the app is in the background or the screen is locked.
 * 
 * Similar to iOS version but with Android-specific optimisations:
 * - Samsung Internet browser specific handling
 * - Chrome Android WebRTC quirks
 */

class AndroidAudioKeepAlive {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isActive = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  
  // Extremely low frequency and volume - inaudible but keeps context alive
  private readonly FREQUENCY = 20; // Below human hearing threshold
  private readonly GAIN = 0.001; // Essentially silent

  /**
   * Start the keep-alive oscillator
   * @param existingContext Optional: Use an existing AudioContext
   */
  async start(existingContext?: AudioContext): Promise<boolean> {
    if (this.isActive) {
      console.log('🔊 Android KeepAlive: Already active');
      return true;
    }

    try {
      // Use existing context or create new one
      this.audioContext = existingContext || new AudioContext();
      
      // Resume if suspended (common on Samsung Internet)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create oscillator with inaudible frequency
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(this.FREQUENCY, this.audioContext.currentTime);

      // Create gain node with minimal volume
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.GAIN, this.audioContext.currentTime);

      // Connect: oscillator -> gain -> destination
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Start the oscillator
      this.oscillator.start();
      
      this.isActive = true;

      // Set up periodic check to ensure context stays alive
      this.startContextMonitor();

      console.log('🔊 Android KeepAlive: Started (inaudible oscillator active)');
      return true;
      
    } catch (error) {
      console.error('🔊 Android KeepAlive: Failed to start:', error);
      return false;
    }
  }

  /**
   * Monitor the AudioContext state and attempt to recover if suspended
   * More aggressive than iOS version - checks every 3 seconds
   */
  private startContextMonitor(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      if (!this.audioContext || !this.isActive) return;

      if (this.audioContext.state === 'suspended') {
        console.warn('🔊 Android KeepAlive: AudioContext suspended, attempting resume...');
        try {
          await this.audioContext.resume();
          console.log('🔊 Android KeepAlive: AudioContext resumed successfully');
        } catch (error) {
          console.error('🔊 Android KeepAlive: Failed to resume AudioContext:', error);
        }
      }
    }, 3000); // Check every 3 seconds (more aggressive than iOS)
  }

  /**
   * Stop the keep-alive oscillator
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {
        // Oscillator may already be stopped
      }
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Don't close the AudioContext - it may be shared
    this.audioContext = null;
    
    this.isActive = false;
    console.log('🔊 Android KeepAlive: Stopped');
  }

  /**
   * Check if keep-alive is currently active
   */
  getIsActive(): boolean {
    return this.isActive && this.audioContext?.state === 'running';
  }

  /**
   * Get the AudioContext state
   */
  getContextState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  /**
   * Quick health check - returns true if the keep-alive is active and the
   * AudioContext is running (not suspended or closed).
   */
  isHealthy(): boolean {
    return this.isActive && this.audioContext?.state === 'running';
  }

  /**
   * Force resume the AudioContext
   * Call this on user interaction (e.g., button tap) to ensure context is active
   */
  async forceResume(): Promise<boolean> {
    if (!this.audioContext) return false;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔊 Android KeepAlive: Forced resume successful');
        return true;
      }
      return this.audioContext.state === 'running';
    } catch (error) {
      console.error('🔊 Android KeepAlive: Forced resume failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const androidAudioKeepAlive = new AndroidAudioKeepAlive();

// Export class for testing
export { AndroidAudioKeepAlive };
