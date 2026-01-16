/**
 * iOS Audio Alert System
 * Plays audio alerts and vibration when transcription stalls on iOS devices.
 * Works even when the screen is locked by using Web Audio API.
 */

class IOSAudioAlert {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private lastAlertTime = 0;
  private readonly MIN_ALERT_INTERVAL_MS = 30000; // Minimum 30 seconds between alerts

  /**
   * Initialize or resume the AudioContext
   * Must be called after a user interaction on iOS
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContext();
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('🔔 iOS Audio Alert initialized, state:', this.audioContext.state);
      return this.audioContext.state === 'running';
    } catch (error) {
      console.error('❌ Failed to initialize iOS Audio Alert:', error);
      return false;
    }
  }

  /**
   * Play a warning beep pattern that works even when screen is locked
   * Uses oscillator to generate tone without requiring audio files
   */
  async playWarningBeep(): Promise<void> {
    const now = Date.now();
    
    // Prevent alert spam
    if (now - this.lastAlertTime < this.MIN_ALERT_INTERVAL_MS) {
      console.log('🔔 Skipping alert - too soon since last alert');
      return;
    }
    
    if (this.isPlaying) {
      console.log('🔔 Skipping alert - already playing');
      return;
    }

    try {
      this.isPlaying = true;
      this.lastAlertTime = now;

      // Initialize if needed
      if (!this.audioContext || this.audioContext.state !== 'running') {
        const success = await this.initialize();
        if (!success) {
          console.warn('⚠️ AudioContext not available for alert');
          this.isPlaying = false;
          return;
        }
      }

      console.log('🔔 Playing transcription stall warning beep');

      // Create a warning beep pattern: beep-beep-beep
      await this.playBeepPattern([
        { frequency: 880, duration: 150 },  // A5
        { pause: 100 },
        { frequency: 880, duration: 150 },  // A5
        { pause: 100 },
        { frequency: 1175, duration: 200 }, // D6 (higher pitched final beep)
      ]);

      // Also try vibration if available
      this.vibrate();

    } catch (error) {
      console.error('❌ Failed to play warning beep:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Play a critical alert (more urgent sound)
   */
  async playCriticalAlert(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastAlertTime < this.MIN_ALERT_INTERVAL_MS / 2) {
      // Allow critical alerts more frequently, but still with some limit
      console.log('🔔 Skipping critical alert - too soon since last alert');
      return;
    }
    
    if (this.isPlaying) return;

    try {
      this.isPlaying = true;
      this.lastAlertTime = now;

      if (!this.audioContext || this.audioContext.state !== 'running') {
        const success = await this.initialize();
        if (!success) {
          this.isPlaying = false;
          return;
        }
      }

      console.log('🚨 Playing CRITICAL transcription stall alert');

      // More urgent pattern: faster, higher pitched
      await this.playBeepPattern([
        { frequency: 1175, duration: 100 },  // D6
        { pause: 50 },
        { frequency: 1175, duration: 100 },  // D6
        { pause: 50 },
        { frequency: 1175, duration: 100 },  // D6
        { pause: 150 },
        { frequency: 1397, duration: 200 },  // F6 (even higher)
        { pause: 50 },
        { frequency: 1175, duration: 200 },  // D6
      ]);

      // Longer vibration pattern for critical
      this.vibrate([200, 100, 200, 100, 400]);

    } catch (error) {
      console.error('❌ Failed to play critical alert:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Play a recovery chime (friendly sound when transcription resumes)
   */
  async playRecoveryChime(): Promise<void> {
    if (this.isPlaying) return;

    try {
      this.isPlaying = true;

      if (!this.audioContext || this.audioContext.state !== 'running') {
        const success = await this.initialize();
        if (!success) {
          this.isPlaying = false;
          return;
        }
      }

      console.log('✅ Playing transcription recovery chime');

      // Pleasant ascending chime
      await this.playBeepPattern([
        { frequency: 523, duration: 100 },  // C5
        { pause: 50 },
        { frequency: 659, duration: 100 },  // E5
        { pause: 50 },
        { frequency: 784, duration: 150 },  // G5
      ]);

    } catch (error) {
      console.error('❌ Failed to play recovery chime:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  private async playBeepPattern(pattern: Array<{ frequency?: number; duration?: number; pause?: number }>): Promise<void> {
    if (!this.audioContext) return;

    for (const item of pattern) {
      if (item.pause) {
        await this.delay(item.pause);
      } else if (item.frequency && item.duration) {
        await this.playTone(item.frequency, item.duration);
      }
    }
  }

  private async playTone(frequency: number, durationMs: number): Promise<void> {
    if (!this.audioContext) return;

    return new Promise((resolve) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      // Envelope to prevent clicking
      const now = this.audioContext!.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Quick attack
      gainNode.gain.setValueAtTime(0.3, now + (durationMs / 1000) - 0.02);
      gainNode.gain.linearRampToValueAtTime(0, now + (durationMs / 1000)); // Quick release
      
      oscillator.start(now);
      oscillator.stop(now + (durationMs / 1000));
      
      oscillator.onended = () => resolve();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private vibrate(pattern: number | number[] = [200, 100, 200]): void {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
        console.log('📳 Vibration triggered');
      }
    } catch (error) {
      // Vibration not available on this device - silently ignore
      console.log('📳 Vibration not available');
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.isPlaying = false;
  }

  /**
   * Reset the alert cooldown timer (call when user acknowledges alert)
   */
  resetCooldown(): void {
    this.lastAlertTime = 0;
  }
}

// Export singleton instance
export const iOSAudioAlert = new IOSAudioAlert();

// Export class for testing
export { IOSAudioAlert };
