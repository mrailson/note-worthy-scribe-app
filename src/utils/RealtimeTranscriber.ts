export class RealtimeTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private chunkCounter = 0;

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Requesting microphone access...');
      await this.startAudioCapture();
      this.onStatusChange('Transcription active');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription: ' + error.message);
    }
  }

  private async startAudioCapture() {
    try {
      console.log('Requesting microphone access...');
      
      // Get microphone access with optimal settings for speech
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100, // Higher quality for better transcription
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Microphone access granted');

      // Check supported MIME types
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];

      let mimeType = 'audio/webm;codecs=opus'; // default
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      console.log('Using MIME type:', mimeType);

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      this.chunkCounter = 0;

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Audio chunk ${this.chunkCounter++} collected:`, event.data.size, 'bytes');
        }
      };

      // Process when recording stops for chunking
      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunks();
        }
      };

      // Start recording in 8-second chunks for more responsive transcription
      this.mediaRecorder.start();
      this.isRecording = true;

      // Process audio every 8 seconds for more real-time feel
      this.scheduleNextProcessing();

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Microphone access denied: ' + error.message);
      throw error;
    }
  }

  private scheduleNextProcessing() {
    if (!this.isRecording) return;
    
    setTimeout(() => {
      if (this.isRecording && this.mediaRecorder?.state === 'recording') {
        console.log('Stopping current recording chunk for processing...');
        this.mediaRecorder.stop();
        
        // Start new recording for next chunk
        setTimeout(() => {
          if (this.isRecording && this.stream) {
            console.log('Starting new recording chunk...');
            
            // Check supported MIME types again
            const supportedTypes = [
              'audio/webm;codecs=opus',
              'audio/webm',
              'audio/mp4',
              'audio/ogg;codecs=opus'
            ];

            let mimeType = 'audio/webm;codecs=opus';
            for (const type of supportedTypes) {
              if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
              }
            }
            
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            
            // Reset event handlers
            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                console.log(`Audio chunk ${this.chunkCounter++} collected:`, event.data.size, 'bytes');
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
    }, 8000); // 8 seconds for more responsive transcription
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) {
      console.log('No audio chunks to process');
      return;
    }

    try {
      // Combine all audio chunks into one blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log(`Processing audio blob: ${audioBlob.size} bytes, ${this.audioChunks.length} chunks`);
      
      // Clear chunks for next batch
      this.audioChunks = [];

      // Skip very small audio files (less than 5KB to ensure meaningful content)
      if (audioBlob.size < 5000) {
        console.log('Skipping small audio chunk:', audioBlob.size, 'bytes');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          console.log('Sending audio to transcription service...');
          
          // Send to transcription service
          const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/assemblyai-transcription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
            },
            body: JSON.stringify({
              audio: base64Data
            })
          });

          console.log('Transcription response status:', response.status);

          if (response.ok) {
            const result = await response.json();
            console.log('Transcription API response:', result);
            
            if (result.text && result.text.trim()) {
              // Filter out common false positives and non-speech
              const text = result.text.trim();
              const lowercaseText = text.toLowerCase();
              
              // Skip if it's just background noise transcription
              const noiseWords = ['thank you', 'thanks for watching', 'bye bye', 'chair please consider'];
              const isNoise = noiseWords.some(noise => lowercaseText.includes(noise));
              
              if (!isNoise && text.length > 3) {
                console.log('Valid transcription received:', text);
                this.onTranscript({
                  text: text,
                  speaker: 'Speaker 1',
                  confidence: result.confidence || 0.85,
                  timestamp: new Date().toISOString(),
                  isFinal: true,
                  words: result.words || []
                });
              } else {
                console.log('Filtered out likely false positive:', text);
              }
            } else {
              console.log('No valid text in transcription response');
            }
          } else {
            const errorData = await response.json();
            console.error('Transcription API error:', response.status, errorData);
            this.onError(`Transcription error: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error processing transcription response:', error);
          this.onError('Failed to process transcription response');
        }
      };
      
      reader.onerror = () => {
        console.error('FileReader error');
        this.onError('Failed to read audio data');
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