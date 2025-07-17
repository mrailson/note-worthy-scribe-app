export class RealtimeTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Connecting...');
      await this.startAudioCapture();
      this.onStatusChange('Connected');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription');
    }
  }

  private async startAudioCapture() {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Standard for speech recognition
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create MediaRecorder with WAV format
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('Audio chunk collected:', event.data.size, 'bytes');
        }
      };

      // Process when recording stops
      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunks();
        }
      };

      // Start recording - collect for 10 seconds at a time
      this.mediaRecorder.start();
      this.isRecording = true;
      this.onStatusChange('Transcription active');

      // Process audio every 10 seconds
      this.scheduleNextProcessing();

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Microphone access denied');
    }
  }

  private scheduleNextProcessing() {
    if (!this.isRecording) return;
    
    setTimeout(() => {
      if (this.isRecording && this.mediaRecorder?.state === 'recording') {
        // Stop current recording to trigger processing
        this.mediaRecorder.stop();
        
        // Start new recording for next chunk
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder && this.stream) {
            this.mediaRecorder = new MediaRecorder(this.stream, {
              mimeType: 'audio/webm;codecs=opus'
            });
            
            // Reset event handlers
            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                this.audioChunks.push(event.data);
              }
            };
            
            this.mediaRecorder.onstop = async () => {
              if (this.audioChunks.length > 0) {
                await this.processAudioChunks();
              }
            };
            
            this.mediaRecorder.start();
            this.scheduleNextProcessing();
          }
        }, 100);
      }
    }, 10000); // 10 seconds
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      // Combine all audio chunks into one blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log('Processing audio blob:', audioBlob.size, 'bytes');
      
      // Clear chunks for next batch
      this.audioChunks = [];

      // Skip very small audio files (less than 1KB)
      if (audioBlob.size < 1000) {
        console.log('Skipping small audio chunk');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          // Send to transcription service
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
              console.log('Transcription received:', result.text);
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
            const errorData = await response.json();
            console.error('Transcription API error:', errorData);
            this.onError(`Transcription error: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error processing transcription:', error);
          this.onError('Failed to process audio');
        }
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      console.error('Error processing audio chunks:', error);
      this.onError('Failed to process audio');
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

    this.mediaRecorder = null;
    this.audioChunks = [];
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