export class SystemAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private stream: MediaStream | null = null;

  constructor(
    private onTranscript: (transcript: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startCapture() {
    try {
      this.onStatusChange('Initializing audio capture...');
      
      // Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Connect microphone
      const micSource = this.audioContext.createMediaStreamSource(micStream);
      const micGain = this.audioContext.createGain();
      micGain.gain.value = 1.0;
      micSource.connect(micGain);
      micGain.connect(destination);

      // Try to capture system audio from various sources
      await this.captureSystemAudio(destination);

      this.stream = destination.stream;
      
      // Set up recording
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      let audioChunks: Blob[] = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0) {
          await this.processAudio(audioChunks);
          audioChunks = [];
        }
      };

      // Record in 5-second chunks for real-time processing
      this.mediaRecorder.start();
      this.isRecording = true;
      this.scheduleProcessing();
      
      this.onStatusChange('Recording both microphone and system audio');
      
    } catch (error) {
      console.error('Error starting capture:', error);
      this.onError('Failed to start audio capture: ' + error.message);
    }
  }

  private async captureSystemAudio(destination: MediaStreamAudioDestinationNode) {
    if (!this.audioContext) return;

    // Method 1: Capture from video/audio elements
    const mediaElements = document.querySelectorAll('video, audio') as NodeListOf<HTMLMediaElement>;
    
    for (const element of mediaElements) {
      try {
        if (!element.paused && element.currentTime > 0) {
          console.log('Connecting media element to audio stream');
          const mediaSource = this.audioContext.createMediaElementSource(element);
          const mediaGain = this.audioContext.createGain();
          mediaGain.gain.value = 1.0;
          
          mediaSource.connect(mediaGain);
          mediaGain.connect(destination);
          
          // Also connect back to speakers so user can still hear
          mediaGain.connect(this.audioContext.destination);
        }
      } catch (error) {
        console.log('Could not connect media element:', error);
      }
    }

    // Method 2: Try to capture from Web Audio nodes if any exist
    try {
      // Check if there are any existing audio contexts
      const existingContexts = (window as any).webAudioContexts || [];
      for (const context of existingContexts) {
        if (context !== this.audioContext) {
          // Try to connect to other audio contexts (experimental)
          console.log('Found existing audio context, attempting to connect');
        }
      }
    } catch (error) {
      console.log('Could not access other audio contexts:', error);
    }

    // Method 3: Monitor for new media elements
    this.monitorForNewMedia(destination);
  }

  private monitorForNewMedia(destination: MediaStreamAudioDestinationNode) {
    // Use MutationObserver to detect new audio/video elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const mediaElements = element.querySelectorAll('video, audio');
            
            mediaElements.forEach((media) => {
              const mediaElement = media as HTMLMediaElement;
              if (!mediaElement.paused && mediaElement.currentTime > 0) {
                try {
                  console.log('New media element detected, connecting...');
                  const mediaSource = this.audioContext!.createMediaElementSource(mediaElement);
                  const mediaGain = this.audioContext!.createGain();
                  mediaGain.gain.value = 1.0;
                  
                  mediaSource.connect(mediaGain);
                  mediaGain.connect(destination);
                  mediaGain.connect(this.audioContext!.destination);
                } catch (error) {
                  console.log('Could not connect new media element:', error);
                }
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private scheduleProcessing() {
    if (!this.isRecording) return;
    
    setTimeout(() => {
      if (this.isRecording && this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop();
        
        // Start new recording
        setTimeout(() => {
          if (this.isRecording && this.stream) {
            this.mediaRecorder = new MediaRecorder(this.stream, {
              mimeType: 'audio/webm;codecs=opus'
            });
            
            let audioChunks: Blob[] = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                audioChunks.push(event.data);
              }
            };

            this.mediaRecorder.onstop = async () => {
              if (audioChunks.length > 0) {
                await this.processAudio(audioChunks);
                audioChunks = [];
              }
            };

            this.mediaRecorder.start();
            this.scheduleProcessing();
          }
        }, 100);
      }
    }, 5000); // Process every 5 seconds
  }

  private async processAudio(audioChunks: Blob[]) {
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      if (audioBlob.size < 1000) {
        console.log('Skipping small audio chunk');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/assemblyai-transcription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
            },
            body: JSON.stringify({ audio: base64Data })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.text && result.text.trim() && result.text.length > 2) {
              this.onTranscript({
                text: result.text,
                speaker: 'Mixed Audio',
                confidence: result.confidence || 0.85,
                timestamp: new Date().toISOString(),
                isFinal: true
              });
            }
          }
        } catch (error) {
          console.error('Error processing transcription:', error);
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }

  stopCapture() {
    this.isRecording = false;
    this.onStatusChange('Stopping...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
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