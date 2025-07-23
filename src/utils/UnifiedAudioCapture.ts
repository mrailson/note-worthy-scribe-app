export class UnifiedAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];

  constructor(
    private onTranscript: (transcript: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startCapture() {
    try {
      this.onStatusChange('Setting up audio capture...');
      console.log('Starting unified audio capture');

      // Step 1: Get microphone access (essential)
      await this.setupMicrophone();
      
      // Step 2: Try to get system audio (optional)
      await this.setupSystemAudio();
      
      // Step 3: Create combined stream
      this.createCombinedStream();
      
      // Step 4: Start recording
      this.startRecording();
      
      this.onStatusChange('Recording microphone + browser audio');
      console.log('Unified audio capture started successfully');
      
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Audio capture failed: ' + error.message);
    }
  }

  private async setupMicrophone() {
    try {
      console.log('Requesting microphone access...');
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('Microphone access granted');
    } catch (error) {
      console.error('Microphone access failed:', error);
      throw new Error('Microphone access required');
    }
  }

  private async setupSystemAudio() {
    try {
      console.log('Requesting system audio access...');
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
      console.log('System audio access granted');
    } catch (error) {
      console.log('System audio access declined or failed, continuing with mic only');
      this.systemStream = null;
    }
  }

  private createCombinedStream() {
    if (!this.micStream) {
      throw new Error('No microphone stream available');
    }

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const destination = this.audioContext.createMediaStreamDestination();

    // Connect microphone
    const micSource = this.audioContext.createMediaStreamSource(this.micStream);
    const micGain = this.audioContext.createGain();
    micGain.gain.value = 1.0;
    micSource.connect(micGain);
    micGain.connect(destination);

    // Connect system audio if available
    if (this.systemStream) {
      try {
        const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
        const systemGain = this.audioContext.createGain();
        systemGain.gain.value = 1.2; // Boost system audio slightly
        systemSource.connect(systemGain);
        systemGain.connect(destination);
        console.log('Combined mic + system audio streams');
      } catch (error) {
        console.error('Failed to connect system audio:', error);
      }
    }

    this.combinedStream = destination.stream;
  }

  private startRecording() {
    if (!this.combinedStream) {
      throw new Error('No audio stream available for recording');
    }

    // Use supported audio format
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {};

    this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        console.log('Audio chunk received:', event.data.size, 'bytes');
      }
    };

    this.mediaRecorder.onstop = () => {
      this.processAudioChunks();
    };

    // Start recording and process every 3 seconds
    this.mediaRecorder.start();
    this.isRecording = true;
    this.scheduleProcessing();
  }

  private scheduleProcessing() {
    if (!this.isRecording) return;

    setTimeout(() => {
      if (this.isRecording && this.mediaRecorder?.state === 'recording') {
        console.log('Stopping recording for processing...');
        this.mediaRecorder.stop();
        
        // Restart recording after brief pause
        setTimeout(() => {
          if (this.isRecording && this.combinedStream) {
            this.startRecording();
          }
        }, 100);
      }
    }, 3000); // Process every 3 seconds
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) {
      console.log('No audio chunks to process');
      return;
    }

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log('Processing audio blob:', audioBlob.size, 'bytes');
      
      // Clear chunks for next batch
      this.audioChunks = [];

      // Skip very small files (likely silence)
      if (audioBlob.size < 3000) {
        console.log('Skipping small audio chunk');
        return;
      }

      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('Sending to transcription service...');
      
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/assemblyai-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ audio: base64Audio })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Transcription result:', result);
        
        if (result.text && result.text.trim() && result.text.length > 2) {
          const text = result.text.trim();
          
          // Basic filtering for obvious hallucinations
          const lowercaseText = text.toLowerCase();
          const commonHallucinations = ['bye', 'thank you', 'music', 'applause'];
          const isLikelyHallucination = commonHallucinations.some(phrase => 
            lowercaseText === phrase || lowercaseText === phrase + '.'
          );
          
          if (!isLikelyHallucination) {
            console.log('Valid transcription:', text);
            this.onTranscript({
              text: text,
              speaker: this.systemStream ? 'Mic + Browser' : 'Microphone',
              confidence: result.confidence || 0.85,
              timestamp: new Date().toISOString(),
              isFinal: true
            });
          } else {
            console.log('Filtered hallucination:', text);
          }
        }
      } else {
        const errorData = await response.json();
        console.error('Transcription error:', errorData);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }

  stopCapture() {
    console.log('Stopping audio capture');
    this.isRecording = false;
    this.onStatusChange('Stopping...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Clean up streams
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      this.systemStream = null;
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.onStatusChange('Stopped');
  }

  isActive() {
    return this.isRecording;
  }
}