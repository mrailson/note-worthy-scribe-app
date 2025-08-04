export class SystemAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mixedStream: MediaStream | null = null;

  async startCapture(): Promise<{ stream: MediaStream; source: string }> {
    try {
      console.log('🔊 Starting enhanced system audio capture...');
      
      // Method 1: Try audio-only screen capture first (best for system audio)
      try {
        console.log('🎵 Attempting audio-only system capture...');
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            sampleRate: 48000,
            channelCount: 2,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        if (this.systemStream.getAudioTracks().length > 0) {
          console.log('✅ Audio-only system capture successful');
          return { stream: this.systemStream, source: 'system-audio-only' };
        }
      } catch (audioOnlyError) {
        console.log('❌ Audio-only capture failed:', audioOnlyError);
      }

      // Method 2: Try video + audio screen capture, then remove video
      try {
        console.log('🖥️ Attempting video+audio screen capture...');
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1 },
            height: { ideal: 1 }
          },
          audio: {
            sampleRate: 48000,
            channelCount: 2,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        // Remove video tracks to save bandwidth
        const videoTracks = this.systemStream.getVideoTracks();
        videoTracks.forEach(track => {
          this.systemStream!.removeTrack(track);
          track.stop();
        });

        if (this.systemStream.getAudioTracks().length > 0) {
          console.log('✅ Video+audio capture successful, video removed');
          return { stream: this.systemStream, source: 'system-video-removed' };
        }
      } catch (videoAudioError) {
        console.log('❌ Video+audio capture failed:', videoAudioError);
      }

      // Method 3: Fallback to high-quality microphone
      console.log('🎤 Falling back to high-quality microphone...');
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      console.log('✅ Microphone fallback successful');
      return { stream: this.micStream, source: 'microphone-fallback' };

    } catch (error) {
      console.error('❌ All audio capture methods failed:', error);
      throw new Error('Failed to capture audio. Please check your browser permissions.');
    }
  }

  // Legacy method for backwards compatibility
  async startCaptureOld(): Promise<MediaStream> {
    const result = await this.startCapture();
    return result.stream;
  }

  stopCapture() {
    console.log('🛑 Stopping system audio capture...');
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        console.log(`🔇 Stopping mic track: ${track.label}`);
        track.stop();
      });
      this.micStream = null;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => {
        console.log(`🔇 Stopping system track: ${track.label}`);
        track.stop();
      });
      this.systemStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mixedStream = null;
    console.log('✅ System audio capture stopped');
  }

  isCapturing(): boolean {
    return !!(this.micStream || this.systemStream);
  }

  getActiveSource(): string {
    if (this.systemStream && this.systemStream.active) {
      return 'system-audio';
    } else if (this.micStream && this.micStream.active) {
      return 'microphone';
    }
    return 'none';
  }

  getAudioTracks(): MediaStreamTrack[] {
    const tracks: MediaStreamTrack[] = [];
    if (this.systemStream) {
      tracks.push(...this.systemStream.getAudioTracks());
    }
    if (this.micStream) {
      tracks.push(...this.micStream.getAudioTracks());
    }
    return tracks;
  }
}