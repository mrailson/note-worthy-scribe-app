export class OpenAIRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Connecting to OpenAI...');
      await this.connectToOpenAI();
      await this.startAudioCapture();
      this.onStatusChange('Recording...');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription: ' + error.message);
    }
  }

  private async connectToOpenAI() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/functions/v1/realtime-transcription`;
    
    this.ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        resolve(undefined);
      };

      this.ws!.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleOpenAIMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws!.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws!.onclose = () => {
        console.log('WebSocket connection closed');
      };
    });
  }

  private handleOpenAIMessage(data: any) {
    if (data.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = data.transcript;
      if (transcript && transcript.trim()) {
        this.onTranscript({
          text: transcript,
          speaker: 'Speaker',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          isFinal: true,
          words: []
        });
      }
    } else if (data.type === 'error') {
      this.onError('OpenAI API error: ' + data.error?.message || 'Unknown error');
    }
  }

  private async startAudioCapture() {
    try {
      // Try to get both microphone and any available system audio
      const constraints = {
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      // Get microphone first
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Try to capture from any active audio elements on the page
      const audioElements = document.querySelectorAll('audio, video');
      if (audioElements.length > 0) {
        try {
          const audioContext = new AudioContext({ sampleRate: 24000 });
          const micSource = audioContext.createMediaStreamSource(this.stream);
          const destination = audioContext.createMediaStreamDestination();
          
          // Connect microphone
          micSource.connect(destination);
          
          // Try to connect any playing media elements
          audioElements.forEach((element) => {
            try {
              const mediaElement = element as HTMLMediaElement;
              if (!mediaElement.paused && mediaElement.currentTime > 0) {
                const mediaSource = audioContext.createMediaElementSource(mediaElement);
                mediaSource.connect(destination);
                console.log('Connected media element to audio stream');
              }
            } catch (e) {
              console.log('Could not connect media element:', e);
            }
          });
          
          this.stream = destination.stream;
        } catch (e) {
          console.log('Could not mix audio sources, using microphone only:', e);
        }
      }

      // Set up MediaRecorder to send chunks to OpenAI
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          // Convert to base64 and send to OpenAI
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = (reader.result as string).split(',')[1];
            this.ws?.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Data
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Record in small chunks for real-time processing
      this.mediaRecorder.start(1000); // 1 second chunks
      this.isRecording = true;

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  stopTranscription() {
    this.isRecording = false;
    this.onStatusChange('Stopping...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.onStatusChange('Stopped');
  }

  isActive() {
    return this.isRecording;
  }
}

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}