export class RealtimeTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private chunkCounter = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private silenceThreshold = 30; // Minimum volume threshold
  private hasDetectedSpeech = false;

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Setting up audio capture...');
      await this.startAudioCapture();
      this.onStatusChange('Listening for speech...');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription: ' + error.message);
    }
  }

  private async startAudioCapture() {
    try {
      console.log('Setting up audio capture...');
      
      // Get microphone access only
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Microphone access granted');
      this.onStatusChange('Recording microphone audio');

      // Set up audio context for voice activity detection
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      
      // Create audio source from microphone
      const micSource = this.audioContext.createMediaStreamSource(this.stream);
      
      // Set up analyser for voice activity detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      micSource.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Check supported MIME types for recording
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

      console.log('Using MIME type:', mimeType);

      // Initialize MediaRecorder with the mixed stream
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      this.chunkCounter = 0;
      this.hasDetectedSpeech = false;

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Audio chunk ${this.chunkCounter++} collected:`, event.data.size, 'bytes');
        }
      };

      // Process when recording stops for chunking
      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0 && this.hasDetectedSpeech) {
          await this.processAudioChunks();
        } else if (!this.hasDetectedSpeech) {
          console.log('No speech detected in this chunk, skipping transcription');
          this.audioChunks = []; // Clear chunks
        }
        this.hasDetectedSpeech = false; // Reset for next chunk
      };

      // Start recording in chunks
      this.mediaRecorder.start();
      this.isRecording = true;

      // Start voice activity detection
      this.startVoiceActivityDetection();

      // Process audio every 10 seconds
      this.scheduleNextProcessing();

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Microphone access denied: ' + error.message);
      throw error;
    }
  }

  private startVoiceActivityDetection() {
    const checkAudioLevel = () => {
      if (!this.analyser || !this.dataArray || !this.isRecording) return;

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;

      // Check if volume is above threshold (indicating speech)
      if (average > this.silenceThreshold) {
        if (!this.hasDetectedSpeech) {
          console.log('Speech detected! Average volume:', average);
          this.hasDetectedSpeech = true;
          this.onStatusChange('Recording speech...');
        }
      }

      // Continue monitoring if recording
      if (this.isRecording) {
        requestAnimationFrame(checkAudioLevel);
      }
    };

    checkAudioLevel();
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
              if (this.audioChunks.length > 0 && this.hasDetectedSpeech) {
                await this.processAudioChunks();
              } else if (!this.hasDetectedSpeech) {
                console.log('No speech detected in this chunk, skipping transcription');
                this.audioChunks = [];
              }
              this.hasDetectedSpeech = false;
            };
            
            this.mediaRecorder.start();
            this.scheduleNextProcessing();
          }
        }, 100);
      }
    }, 10000); // 10 seconds
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
              // Enhanced filtering for false positives
              const text = result.text.trim();
              const lowercaseText = text.toLowerCase();
              
              // Comprehensive list of common false positives from Whisper
              const falsePositives = [
                'thank you',
                'thanks for watching',
                'bye bye',
                'chair please consider',
                'thank you for watching',
                'thanks for',
                'please consider',
                'goodbye',
                'see you',
                'until next time',
                'have a good',
                'take care',
                'music',
                'applause',
                'laughter',
                '♪',
                'you'
              ];
              
              // Check if the text is likely a false positive
              const isFalsePositive = falsePositives.some(phrase => 
                lowercaseText.includes(phrase) || 
                lowercaseText === phrase ||
                text.length < 4 // Very short texts are usually false positives
              );
              
              // Additional check: if text is repetitive or very generic
              const isRepetitive = /^(.{1,10})\1+$/.test(text.toLowerCase());
              
              if (!isFalsePositive && !isRepetitive && text.length > 4) {
                console.log('Valid transcription received:', text);
                this.onStatusChange('Transcription active');
                this.onTranscript({
                  text: text,
                  speaker: 'Speaker 1',
                  confidence: result.confidence || 0.85,
                  timestamp: new Date().toISOString(),
                  isFinal: true,
                  words: result.words || []
                });
              } else {
                console.log('Filtered out false positive/noise:', text);
                this.onStatusChange('Listening for speech...');
              }
            } else {
              console.log('No valid text in transcription response');
              this.onStatusChange('Listening for speech...');
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

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyser = null;
    this.dataArray = null;
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