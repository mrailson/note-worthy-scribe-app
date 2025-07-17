export class RealtimeTranscriber {
  private socket: WebSocket | null = null;
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
      this.onStatusChange('Connecting...');
      
      // Start audio capture first
      await this.startAudioCapture();
      
      this.onStatusChange('Connected');
      
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription');
    }
  }

  private async sendAudioChunk(audioBlob: Blob) {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        // Send to our Supabase Edge Function
        const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/assemblyai-transcription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Data
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.text && result.text.trim()) {
            this.onTranscript({
              text: result.text.trim(),
              speaker: 'Speaker 1',
              confidence: 0.95,
              timestamp: new Date().toISOString(),
              isFinal: true,
              words: result.words || []
            });
          }
        } else {
          console.error('Transcription API error:', response.status);
          this.onError('Transcription service error');
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending audio chunk:', error);
      this.onError('Failed to process audio');
    }
  }

  private async startAudioCapture() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Use MediaRecorder for WebM format that Google Cloud supports
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          console.log('Audio chunk available, size:', event.data.size);
          this.sendAudioChunk(event.data);
        }
      };

      // Start recording with 5-second intervals for better transcription
      this.mediaRecorder.start(5000);
      this.isRecording = true;
      this.onStatusChange('Transcription active');
      
      console.log('Audio recording started');

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Microphone access denied');
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

    this.socket = null;
    this.mediaRecorder = null;
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