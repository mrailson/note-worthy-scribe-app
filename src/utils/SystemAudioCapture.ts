export class SystemAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mixedStream: MediaStream | null = null;

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
            noiseSuppression: false
          }
        });
      } catch (error) {
        console.log('System audio not available, using microphone only:', error);
        return this.micStream;
      }

      // Mix both audio streams
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      const micSource = this.audioContext.createMediaStreamSource(this.micStream);
      const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
      
      const destination = this.audioContext.createMediaStreamDestination();
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.8; // Slightly reduce volume to prevent clipping
      
      // Connect both sources to destination
      micSource.connect(gainNode);
      systemSource.connect(gainNode);
      gainNode.connect(destination);
      
      this.mixedStream = destination.stream;
      return this.mixedStream;

    } catch (error) {
      console.error('Error setting up audio capture:', error);
      throw new Error('Failed to capture audio');
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
    
    this.mixedStream = null;
  }

  isCapturing(): boolean {
    return !!(this.micStream || this.systemStream);
  }
}