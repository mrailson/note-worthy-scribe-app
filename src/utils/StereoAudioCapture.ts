export class StereoAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private stereoStream: MediaStream | null = null;

  async startCapture(): Promise<MediaStream> {
    try {
      // Get microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Try to get system audio (screen share with audio)
      try {
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (error) {
        console.log('System audio not available, using microphone only:', error);
        return this.micStream;
      }

      // Create stereo stream: Left = Mic, Right = System
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      const micSource = this.audioContext.createMediaStreamSource(this.micStream);
      const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
      
      // Create a stereo merger (2 channels)
      const merger = this.audioContext.createChannelMerger(2);
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Connect mic to left channel (0), system to right channel (1)
      micSource.connect(merger, 0, 0);    // Left channel = microphone
      systemSource.connect(merger, 0, 1); // Right channel = system audio
      
      merger.connect(destination);
      
      this.stereoStream = destination.stream;
      
      console.log('🎧 Created stereo stream: Left=Mic, Right=System');
      return this.stereoStream;

    } catch (error) {
      console.error('Error setting up stereo audio capture:', error);
      throw new Error('Failed to capture stereo audio');
    }
  }

  stopCapture() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      this.systemStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.stereoStream = null;
  }

  isCapturing(): boolean {
    return !!(this.micStream || this.systemStream);
  }

  // Helper methods to get individual streams if needed
  getMicrophoneStream(): MediaStream | null {
    return this.micStream;
  }

  getSystemStream(): MediaStream | null {
    return this.systemStream;
  }

  getStereoStream(): MediaStream | null {
    return this.stereoStream;
  }
}