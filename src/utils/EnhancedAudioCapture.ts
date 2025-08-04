export class EnhancedAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;

  constructor(
    private onTranscript: (transcript: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startCapture() {
    try {
      this.onStatusChange('Setting up enhanced audio capture...');
      
      // Create audio context first
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Microphone captured');
      
      // Create destination for mixed audio
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Connect microphone
      const micSource = this.audioContext.createMediaStreamSource(micStream);
      const micGain = this.audioContext.createGain();
      micGain.gain.value = 1.0;
      micSource.connect(micGain);
      micGain.connect(destination);

      // Try multiple methods to capture system audio
      await this.captureSystemAudio(destination);

      this.stream = destination.stream;
      
      // Use ScriptProcessorNode for real-time audio processing
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      const streamSource = this.audioContext.createMediaStreamSource(this.stream);
      streamSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      let audioBuffer: Float32Array[] = [];
      let bufferDuration = 0;
      const targetDuration = 3; // 3 seconds

      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        audioBuffer.push(new Float32Array(inputData));
        bufferDuration += inputData.length / this.audioContext!.sampleRate;

        // Process every 3 seconds
        if (bufferDuration >= targetDuration) {
          this.processAudioBuffer(audioBuffer);
          audioBuffer = [];
          bufferDuration = 0;
        }
      };

      this.isRecording = true;
      this.onStatusChange('Recording with enhanced audio capture');
      
    } catch (error) {
      console.error('Enhanced audio capture failed:', error);
      this.onError('Enhanced audio capture failed: ' + error.message);
    }
  }

  private async captureSystemAudio(destination: MediaStreamAudioDestinationNode) {
    if (!this.audioContext) return;

    console.log('Attempting to capture system audio...');

    // Method 1: Capture from existing audio/video elements
    const mediaElements = document.querySelectorAll('audio, video') as NodeListOf<HTMLMediaElement>;
    let capturedCount = 0;
    
    for (const element of mediaElements) {
      try {
        if (!element.paused && element.currentTime > 0 && !element.muted) {
          console.log('Connecting active media element');
          const mediaSource = this.audioContext.createMediaElementSource(element);
          const mediaGain = this.audioContext.createGain();
          mediaGain.gain.value = 1.2; // Boost system audio slightly
          
          mediaSource.connect(mediaGain);
          mediaGain.connect(destination);
          // Also connect back to speakers
          mediaGain.connect(this.audioContext.destination);
          capturedCount++;
        }
      } catch (error) {
        console.log('Could not connect media element:', error);
      }
    }

    // Method 2: Try to capture Web Audio API contexts
    try {
      // Hook into any existing AudioContext instances
      const originalCreateMediaElementSource = AudioContext.prototype.createMediaElementSource;
      AudioContext.prototype.createMediaElementSource = function(element) {
        const source = originalCreateMediaElementSource.call(this, element);
        // Try to tap into this source if possible
        try {
          const gain = this.createGain();
          gain.gain.value = 1.0;
          source.connect(gain);
          if (destination && this === destination.context) {
            gain.connect(destination);
          }
        } catch (e) {
          console.log('Could not tap into audio source:', e);
        }
        return source;
      };
    } catch (error) {
      console.log('Could not hook into Web Audio API:', error);
    }

    // Method 3: Monitor for new audio elements
    this.monitorForNewAudio(destination);

    if (capturedCount > 0) {
      console.log(`Successfully connected to ${capturedCount} audio sources`);
      this.onStatusChange(`Recording: microphone + ${capturedCount} system audio source(s)`);
    } else {
      console.log('No active system audio found, using microphone only');
      this.onStatusChange('Recording: microphone only (no system audio detected)');
    }
  }

  private monitorForNewAudio(destination: MediaStreamAudioDestinationNode) {
    const observer = new MutationObserver((mutations) => {
      try {
        mutations.forEach((mutation) => {
          // Only process added nodes to avoid issues with removed nodes
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              // Ensure it's an element node before processing
              if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
                try {
                  const mediaElements = node.querySelectorAll('audio, video');
                  
                  mediaElements.forEach((media) => {
                    const mediaElement = media as HTMLMediaElement;
                    // Wait a bit for the element to start playing
                    setTimeout(() => {
                      if (!mediaElement.paused && mediaElement.currentTime > 0 && !mediaElement.muted) {
                        try {
                          console.log('New active media element detected');
                          const mediaSource = this.audioContext!.createMediaElementSource(mediaElement);
                          const mediaGain = this.audioContext!.createGain();
                          mediaGain.gain.value = 1.2;
                          
                          mediaSource.connect(mediaGain);
                          mediaGain.connect(destination);
                          mediaGain.connect(this.audioContext!.destination);
                        } catch (error) {
                          console.log('Could not connect new media element:', error);
                        }
                      }
                    }, 1000);
                  });
                } catch (elementError) {
                  console.log('Error processing element:', elementError);
                }
              }
            });
          }
        });
      } catch (mutationError) {
        console.log('Error processing mutation:', mutationError);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private async processAudioBuffer(audioBuffer: Float32Array[]) {
    try {
      // Combine all audio chunks
      const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of audioBuffer) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Check for actual audio activity (not just silence)
      const rms = Math.sqrt(combinedBuffer.reduce((sum, sample) => sum + sample * sample, 0) / combinedBuffer.length);
      
      if (rms < 0.01) {
        console.log('Audio level too low, skipping transcription. RMS:', rms);
        return;
      }

      console.log('Processing audio with RMS:', rms);

      // Convert to base64 for API
      const audioData = this.encodeAudioData(combinedBuffer);
      
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/assemblyai-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ audio: audioData })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.text && result.text.trim() && result.text.length > 3) {
          this.onTranscript({
            text: result.text,
            speaker: 'Enhanced Audio',
            confidence: result.confidence || 0.85,
            timestamp: new Date().toISOString(),
            isFinal: true
          });
        }
      }
    } catch (error) {
      console.error('Error processing audio buffer:', error);
    }
  }

  private encodeAudioData(float32Array: Float32Array): string {
    // Convert to 16-bit PCM
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Create WAV file
    const wavBuffer = this.createWAVFile(int16Array, 24000);
    
    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(wavBuffer);
    const chunkSize = 0x8000;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  private createWAVFile(audioData: Int16Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, audioData.length * 2, true);
    
    // Audio data
    const audioView = new Int16Array(buffer, 44);
    audioView.set(audioData);
    
    return buffer;
  }

  stopCapture() {
    this.isRecording = false;
    this.onStatusChange('Stopping enhanced capture...');

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onStatusChange('Stopped');
  }

  isActive() {
    return this.isRecording;
  }
}