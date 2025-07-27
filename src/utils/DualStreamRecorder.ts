export interface AudioChunk {
  audio: string; // base64 encoded
  stream: 'microphone' | 'speaker';
  timestamp: number;
  sequence: number;
}

export interface DualStreamConfig {
  onTranscript?: (transcript: string) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  chunkDuration?: number; // seconds
}

export class DualStreamRecorder {
  private micStream: MediaStream | null = null;
  private speakerStream: MediaStream | null = null;
  private micRecorder: MediaRecorder | null = null;
  private speakerRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private audioChunks: AudioChunk[] = [];
  private sequenceCounter = 0;
  private processingTimer: NodeJS.Timeout | null = null;
  
  constructor(private config: DualStreamConfig = {}) {}

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.config.onStatusChange?.('Setting up microphone...');
      
      // Get microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 12000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.config.onStatusChange?.('Setting up speaker capture...');
      
      try {
        // Try to get speaker/system audio stream using getDisplayMedia
        // Note: Most browsers require video=true for getDisplayMedia
        this.speakerStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1 },
            height: { ideal: 1 }
          },
          audio: {
            sampleRate: 12000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        // Remove video tracks since we only need audio
        const videoTracks = this.speakerStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          this.speakerStream!.removeTrack(track);
        });
        
        this.config.onStatusChange?.('✅ Screen audio capture enabled - will record system audio');
      } catch (screenError) {
        console.warn('Screen capture failed, using fallback:', screenError);
        this.config.onStatusChange?.('⚠️ Screen capture not available, using microphone-only mode for testing');
        
        // Fallback: Use a second microphone stream as "speaker" for testing
        this.speakerStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 12000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        this.config.onStatusChange?.('📱 Using dual microphone mode for testing');
      }

      // Set up media recorders
      this.setupRecorders();
      
      // Start recording both streams
      this.micRecorder?.start(1000); // 1 second chunks
      this.speakerRecorder?.start(1000);
      
      this.isRecording = true;
      this.config.onStatusChange?.('Recording both microphone and speaker...');
      
      // Start periodic processing
      this.startPeriodicProcessing();
      
    } catch (error) {
      console.error('Error starting dual stream recording:', error);
      this.cleanup();
      throw error;
    }
  }

  private setupRecorders(): void {
    if (!this.micStream || !this.speakerStream) {
      throw new Error('Audio streams not available');
    }

    // Try different audio formats for better OpenAI compatibility
    const supportedMimeTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm;codecs=opus'
    ];
    
    let mimeType = 'audio/webm;codecs=opus'; // fallback
    for (const type of supportedMimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Using mime type: ${mimeType}`);
        break;
      }
    }

    // Microphone recorder
    this.micRecorder = new MediaRecorder(this.micStream, {
      mimeType,
      audioBitsPerSecond: 16000
    });

    this.micRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.processAudioChunk(event.data, 'microphone');
      }
    };

    // Speaker recorder
    this.speakerRecorder = new MediaRecorder(this.speakerStream, {
      mimeType,
      audioBitsPerSecond: 16000
    });

    this.speakerRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.processAudioChunk(event.data, 'speaker');
      }
    };
  }

  private async processAudioChunk(blob: Blob, stream: 'microphone' | 'speaker'): Promise<void> {
    try {
      // Skip empty or very small blobs (less than 1KB)
      if (blob.size < 1024) {
        console.log(`Skipping small ${stream} audio chunk: ${blob.size} bytes`);
        return;
      }

      console.log(`Processing ${stream} audio chunk: ${blob.size} bytes`);
      
      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binary);
      
      // Add to chunks array
      const audioChunk: AudioChunk = {
        audio: base64Audio,
        stream,
        timestamp: Date.now(),
        sequence: this.sequenceCounter++
      };
      
      this.audioChunks.push(audioChunk);
      
    } catch (error) {
      console.error(`Error processing ${stream} audio chunk:`, error);
      this.config.onError?.(`Error processing ${stream} audio: ${error.message}`);
    }
  }

  private startPeriodicProcessing(): void {
    const processingInterval = (this.config.chunkDuration || 10) * 1000; // Convert to milliseconds
    
    this.processingTimer = setInterval(() => {
      this.processAccumulatedChunks();
    }, processingInterval);
  }

  private async processAccumulatedChunks(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      this.config.onStatusChange?.('Processing audio chunks...');
      
      // Get chunks to process (last 10 seconds worth)
      const chunksToProcess = [...this.audioChunks];
      this.audioChunks = []; // Clear processed chunks
      
      // Call edge function to transcribe
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/dual-stream-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioChunks: chunksToProcess
        })
      });

      if (!response.ok) {
        throw new Error(`Transcription request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.transcript && result.transcript.trim()) {
        this.config.onTranscript?.(result.transcript);
        this.config.onStatusChange?.(`Processed ${result.processedChunks}/${result.totalChunks} chunks`);
      }
      
    } catch (error) {
      console.error('Error processing audio chunks:', error);
      this.config.onError?.(`Transcription error: ${error.message}`);
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.config.onStatusChange?.('Stopping recording...');
    
    try {
      // Stop recorders
      this.micRecorder?.stop();
      this.speakerRecorder?.stop();
      
      // Clear processing timer
      if (this.processingTimer) {
        clearInterval(this.processingTimer);
        this.processingTimer = null;
      }
      
      // Process any remaining chunks
      if (this.audioChunks.length > 0) {
        await this.processAccumulatedChunks();
      }
      
      this.isRecording = false;
      this.cleanup();
      
      this.config.onStatusChange?.('Recording stopped');
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.config.onError?.(`Error stopping recording: ${error.message}`);
    }
  }

  private cleanup(): void {
    // Stop and clean up media streams
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.speakerStream) {
      this.speakerStream.getTracks().forEach(track => track.stop());
      this.speakerStream = null;
    }
    
    this.micRecorder = null;
    this.speakerRecorder = null;
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
  
  getPendingChunks(): number {
    return this.audioChunks.length;
  }
}