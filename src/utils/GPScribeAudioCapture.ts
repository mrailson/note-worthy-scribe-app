import { TranscriptCleaner } from './TranscriptCleaner';
import { RealtimeTranscriptCleaner } from './RealtimeTranscriptCleaner';

export class GPScribeAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  
  // Transcript assembly system - optimized for consultation
  private transcriptBuffer: string[] = [];
  private lastTranscriptTime = Date.now();
  private transcriptAssemblyTimer: NodeJS.Timeout | null = null;
  private cleaningBuffer: any = null;
  private realtimeCleaner: RealtimeTranscriptCleaner | null = null;

  constructor(
    private onTranscript: (transcript: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startCapture() {
    try {
      this.onStatusChange('Setting up consultation audio capture...');
      console.log('🎤 Starting GP Scribe audio capture...');

      // Step 1: Get microphone access (essential for consultations)
      await this.setupMicrophone();
      
      // Step 2: Create stream for consultation recording
      this.createCombinedStream();
      
      // Step 3: Start recording
      this.startRecording();
      
      // CONSULTATION MODE - Continuous recording optimized for medical dialogue
      console.log('🩺 CONSULTATION MODE: Recording medical consultation...');
      
    } catch (error) {
      console.error('GP Scribe audio capture failed:', error);
      this.onError(`Failed to start consultation recording: ${error.message}`);
    }
  }

  private async setupMicrophone() {
    try {
      console.log('🎤 Setting up consultation microphone...');
      
      // Optimized audio settings for medical consultations
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100, // Higher quality for medical terminology
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Consultation microphone ready');
    } catch (error) {
      console.error('Microphone setup failed:', error);
      throw new Error(`Microphone access required for consultation recording: ${error.message}`);
    }
  }

  private createCombinedStream() {
    try {
      if (!this.micStream) {
        throw new Error('Microphone stream not available');
      }

      // For consultations, we primarily focus on microphone audio
      this.combinedStream = this.micStream.clone();
      
      console.log('✅ Consultation audio stream created');
    } catch (error) {
      console.error('Failed to create consultation stream:', error);
      throw error;
    }
  }

  private startRecording() {
    try {
      if (!this.combinedStream) {
        throw new Error('No audio stream available for consultation');
      }

      // Initialize MediaRecorder with consultation-optimized settings
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // Good quality for medical audio
      };

      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📊 Consultation audio chunk: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processConsultationAudio();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('Consultation recording error:', event);
        this.onError('Consultation recording failed');
      };

      // Start recording consultation
      this.mediaRecorder.start(5000); // 5-second chunks for consultation
      this.isRecording = true;
      
      this.onStatusChange('Recording consultation...');
      console.log('🎙️ Consultation recording started');
      
    } catch (error) {
      console.error('Failed to start consultation recording:', error);
      this.onError(`Recording failed: ${error.message}`);
    }
  }

  private async processConsultationAudio() {
    try {
      if (this.audioChunks.length === 0) {
        console.warn('No consultation audio data to process');
        return;
      }

      console.log('🔄 Processing consultation audio...');
      
      // Create audio blob from consultation chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log(`📦 Consultation audio blob: ${audioBlob.size} bytes`);

      // Convert to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      
      // Process in chunks to avoid memory issues with long consultations
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binaryString);
      
      // Send to consultation-specific transcription service
      await this.transcribeConsultationAudio(base64Audio);
      
    } catch (error) {
      console.error('Failed to process consultation audio:', error);
      this.onError(`Audio processing failed: ${error.message}`);
    }
  }

  private async transcribeConsultationAudio(audioData: string) {
    try {
      this.onStatusChange('Transcribing consultation...');
      console.log('🔤 Sending consultation audio for transcription...');

      // Use consultation-specific transcription endpoint
      const response = await fetch('https://dphcnbricafkbtizkoal.supabase.co/functions/v1/speech-to-text-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`
        },
        body: JSON.stringify({ audio: audioData })
      });

      if (!response.ok) {
        throw new Error(`Transcription service error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.text) {
        console.log('📝 Consultation transcription received:', result.text.substring(0, 100) + '...');
        
        // Process consultation transcript
        this.processConsultationTranscript(result.text);
      }
      
    } catch (error) {
      console.error('Consultation transcription failed:', error);
      this.onError(`Transcription failed: ${error.message}`);
    }
  }

  private processConsultationTranscript(text: string) {
    // Add medical consultation context
    const transcriptData = {
      text: text,
      speaker: "Consultation",
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      isFinal: true,
      isConsultation: true // Mark as consultation transcript
    };

    // Clean transcript for medical terminology using simple cleaning
    const cleanedText = this.cleanMedicalTranscript(text);
    
    if (cleanedText !== text) {
      transcriptData.text = cleanedText;
      console.log('🧹 Consultation transcript cleaned for medical context');
    }

    // Emit consultation transcript
    this.onTranscript(transcriptData);
    this.onStatusChange('Consultation transcribed');
  }

  private cleanMedicalTranscript(text: string): string {
    // Basic medical terminology cleaning
    let cleaned = text;
    
    // Medical abbreviations and corrections
    const medicalCorrections = {
      'bee pee': 'BP',
      'heart rate': 'HR',
      'blood pressure': 'BP',
      'milligrams': 'mg',
      'milliliters': 'ml'
    };

    Object.entries(medicalCorrections).forEach(([original, corrected]) => {
      const regex = new RegExp(original, 'gi');
      cleaned = cleaned.replace(regex, corrected);
    });

    return cleaned;
  }

  stopCapture() {
    console.log('🛑 Stopping consultation capture...');
    
    try {
      // Stop recording
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
        this.isRecording = false;
      }

      // Clean up timers
      if (this.transcriptAssemblyTimer) {
        clearTimeout(this.transcriptAssemblyTimer);
        this.transcriptAssemblyTimer = null;
      }

      // Stop audio streams
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => {
          track.stop();
          console.log('🎤 Consultation microphone track stopped');
        });
        this.micStream = null;
      }

      if (this.combinedStream) {
        this.combinedStream.getTracks().forEach(track => track.stop());
        this.combinedStream = null;
      }

      // Close audio context
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      // Clean up consultation-specific resources
      this.transcriptBuffer = [];
      this.audioChunks = [];
      this.realtimeCleaner = null;

      this.onStatusChange('Consultation recording stopped');
      console.log('✅ Consultation capture stopped and cleaned up');
      
    } catch (error) {
      console.error('Error stopping consultation capture:', error);
      this.onError(`Failed to stop recording: ${error.message}`);
    }
  }

  // Consultation-specific methods
  pauseConsultation() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.pause();
      this.onStatusChange('Consultation paused');
      console.log('⏸️ Consultation recording paused');
    }
  }

  resumeConsultation() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.resume();
      this.onStatusChange('Recording consultation...');
      console.log('▶️ Consultation recording resumed');
    }
  }

  isActive(): boolean {
    return this.isRecording;
  }

  // Get consultation-specific status
  getConsultationStatus() {
    return {
      isRecording: this.isRecording,
      hasAudio: this.audioChunks.length > 0,
      microphoneActive: !!this.micStream?.active,
      transcriptBufferSize: this.transcriptBuffer.length
    };
  }
}