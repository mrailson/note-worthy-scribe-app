import { TranscriptCleaner } from './TranscriptCleaner';
import { RealtimeTranscriptCleaner } from './RealtimeTranscriptCleaner';

export class UnifiedAudioCapture {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  
  // Transcript assembly system
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

  async startCapture(mode: 'mic-only' | 'mic-browser' = 'mic-only') {
    try {
      this.onStatusChange('Setting up audio capture...');
      console.log(`Starting unified audio capture in ${mode} mode`);

      // Step 1: Get microphone access (essential)
      await this.setupMicrophone();
      
      // Step 2: Try to get system audio only if requested
      if (mode === 'mic-browser') {
        await this.setupSystemAudio();
      } else {
        console.log('Skipping browser audio setup - mic-only mode selected');
        this.systemStream = null;
      }
      
      // Step 3: Create combined stream
      this.createCombinedStream();
      
      // Step 4: Start recording
      this.startRecording();
      
      // SINGLE SESSION MODE - No real-time processing
      console.log('🎵 SINGLE SESSION MODE: Recording continuously until stop - no real-time transcription');
      
      const statusMessage = mode === 'mic-browser' ? 'Recording microphone + browser audio (session mode)' : 'Recording microphone only (session mode)';
      this.onStatusChange(statusMessage);
      console.log('Unified audio capture started successfully - session recording mode');
      
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
      console.log('Requesting screen share with system audio...');
      console.log('Please select "Share system audio" when prompted');
      
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
          frameRate: { ideal: 1 }
        },
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Check if audio track was actually included
      const audioTracks = this.systemStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('System audio access granted - browser/speaker audio will be captured');
      } else {
        console.log('Screen sharing granted but no audio track - please make sure to check "Share system audio"');
        this.systemStream = null;
      }
    } catch (error) {
      console.log('Screen sharing declined or failed, continuing with mic only');
      console.log('To capture browser audio, please allow screen sharing and check "Share system audio"');
      this.systemStream = null;
    }
  }

  private createCombinedStream() {
    if (!this.micStream) {
      throw new Error('No microphone stream available');
    }

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const destination = this.audioContext.createMediaStreamDestination();

    // Always connect microphone first
    console.log('Connecting microphone to combined stream...');
    const micSource = this.audioContext.createMediaStreamSource(this.micStream);
    const micGain = this.audioContext.createGain();
    micGain.gain.value = 1.2; // Boost mic audio
    micSource.connect(micGain);
    micGain.connect(destination);
    console.log('Microphone connected with gain:', micGain.gain.value);

    // Connect system audio if available
    if (this.systemStream && this.systemStream.getAudioTracks().length > 0) {
      try {
        console.log('Connecting browser/system audio to combined stream...');
        const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
        const systemGain = this.audioContext.createGain();
        systemGain.gain.value = 0.8; // Slightly lower browser audio to avoid overwhelming mic
        systemSource.connect(systemGain);
        systemGain.connect(destination);
        console.log('Browser audio connected with gain:', systemGain.gain.value);
        console.log('Combined mic + browser audio streams successfully');
      } catch (error) {
        console.error('Failed to connect system audio:', error);
        console.log('Continuing with microphone only');
      }
    } else {
      console.log('No browser audio available, using microphone only');
    }

    this.combinedStream = destination.stream;
    
    // Log the final stream details
    const audioTracks = this.combinedStream.getAudioTracks();
    console.log('Final combined stream has', audioTracks.length, 'audio tracks');
    audioTracks.forEach((track, index) => {
      console.log(`Track ${index}:`, {
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState
      });
    });
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
        console.log(`Audio chunk ${this.audioChunks.length} collected:`, event.data.size, 'bytes');
        // Collecting all audio for end-of-session transcription
      }
    };

    this.mediaRecorder.onstop = () => {
      // Only transcribe when recording actually stops (end of session)
      console.log('Recording stopped - processing complete session audio');
      this.processAudioChunks();
    };

    // Start continuous recording - no scheduled stops
    this.mediaRecorder.start(); // Continuous recording until manually stopped
    this.isRecording = true;
  }

  private isLikelyHallucination(text: string): boolean {
    // Common Whisper hallucinations - keep exact matches only
    const exactHallucinations = [
      'bye', 'bye-bye', 'bye bye', 'goodbye',
      'thank you', 'thanks', 'thank you very much', 
      'thank you for listening', 'thank you for joining',
      'thank you for watching', 'thank you for your time',
      'good night', 'goodnight', 'good morning', 'good afternoon'
    ];

    // Religious/Arabic phrases that Whisper hallucinates
    const religiousPatterns = [
      'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 'bismillah'
    ];

    // Check exact matches
    if (exactHallucinations.includes(text.toLowerCase().trim())) {
      return true;
    }

    // Check for religious hallucinations
    if (religiousPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
      return true;
    }

    // Only filter extremely repetitive patterns (same word 4+ times)
    const words = text.split(' ');
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) {
        return true; // Repetitive like "bye bye bye bye"
      }
    }

    return false;
  }

  private scheduleProcessing() {
    // No chunking - we'll transcribe everything at the end for maximum accuracy
    console.log('Single session recording mode - no chunking scheduled');
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) {
      console.log('No audio chunks to process');
      return;
    }

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const totalChunks = this.audioChunks.length;
      console.log('Processing audio blob:', audioBlob.size, 'bytes,', totalChunks, 'chunks');
      
      // Clear chunks for next batch
      this.audioChunks = [];

      // Process all audio at end of session regardless of size
      if (audioBlob.size < 100) { // Only skip if truly empty
        console.log('Skipping empty audio chunk');
        return;
      }

      const startTime = Date.now();
      console.log('🎵 SINGLE SESSION TRANSCRIPTION - Starting Whisper processing...');
      console.log('📏 Audio file size:', audioBlob.size, 'bytes', `(${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log('⏱️ Total recording chunks collected:', totalChunks);

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

      console.log('🔄 Sending complete session audio to Whisper...');
      
      // Use direct Whisper transcription for faster processing
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/test-mp3-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ audio: base64Audio })
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log('⏱️ Whisper processing completed in:', processingTime, 'ms', `(${(processingTime / 1000).toFixed(1)}s)`);

      if (response.ok) {
        const result = await response.json();
        const transcriptionText = result.text || '';
        
        console.log('✅ WHISPER TRANSCRIPTION COMPLETE:', {
          fileSize: `${audioBlob.size} bytes (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)`,
          processingTime: `${processingTime}ms (${(processingTime / 1000).toFixed(1)}s)`,
          textLength: transcriptionText.length,
          confidence: result.confidence || 'N/A',
          validation: result.validation || 'N/A'
        });

        // Trigger transcript update
        if (this.onTranscript) {
          this.onTranscript({
            text: transcriptionText,
            speaker: this.systemStream ? 'Mic + Browser (Complete Session)' : 'Microphone (Complete Session)',
            confidence: result.confidence || 0.95,
            timestamp: new Date().toISOString(),
            isFinal: true,
            isCompleteSession: true
          });
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Whisper transcription failed:', response.status, errorText);
        
        // Try alternative transcription method if first attempt fails
        console.log('🔄 Trying alternative transcription approach...');
        await this.fallbackDirectWhisper(base64Audio, audioBlob.size, startTime);
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }

  private async fallbackDirectWhisper(base64Audio: string, fileSize: number, startTime: number) {
    try {
      console.log('🔄 Using fallback direct Whisper transcription...');
      
      // Use the test-mp3-transcription function for direct Whisper
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/test-mp3-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ audio: base64Audio })
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      if (response.ok) {
        const result = await response.json();
        const transcriptionText = result.text || '';
        
        console.log('✅ FALLBACK WHISPER TRANSCRIPTION COMPLETE:', {
          fileSize: `${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
          processingTime: `${processingTime}ms (${(processingTime / 1000).toFixed(1)}s)`,
          textLength: transcriptionText.length
        });

        if (this.onTranscript && transcriptionText) {
          this.onTranscript({
            text: transcriptionText,
            speaker: this.systemStream ? 'Mic + Browser (Fallback)' : 'Microphone (Fallback)',
            confidence: 0.85,
            timestamp: new Date().toISOString(),
            isFinal: true,
            isCompleteSession: true
          });
        }
      } else {
        console.error('❌ Fallback Whisper also failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error in fallback Whisper:', error);
    }
  }

  // DISABLED - No test audio in single session mode
  private async sendTestAudio() {
    console.log('🎵 Test audio disabled in single session mode');
  }

  
  // Transcript assembly methods
  private addToTranscriptBuffer(text: string) {
    // Clean up the text fragment
    const cleanText = text.trim();
    if (!cleanText) return;

    console.log('Adding to transcript buffer:', cleanText);
    this.transcriptBuffer.push(cleanText);
    this.lastTranscriptTime = Date.now();

    // Reset the assembly timer
    if (this.transcriptAssemblyTimer) {
      clearTimeout(this.transcriptAssemblyTimer);
    }

    // Set a timer to assemble transcript after a pause in speech
    this.transcriptAssemblyTimer = setTimeout(() => {
      this.assembleAndOutputTranscript();
    }, 1500); // Wait 1.5 seconds after last fragment for faster output
  }

  private assembleAndOutputTranscript() {
    if (this.transcriptBuffer.length === 0) return;

    console.log('Assembling transcript from', this.transcriptBuffer.length, 'fragments');
    
    // Join the fragments and clean up
    let assembledText = this.transcriptBuffer.join(' ');
    
    // Clean up the assembled text
    assembledText = this.cleanUpTranscript(assembledText);
    
    if (assembledText.length > 0) {
      console.log('Outputting assembled transcript:', assembledText);
      
      this.onTranscript({
        text: assembledText,
        speaker: this.systemStream ? 'Mic + Browser' : 'Microphone',
        confidence: 0.85,
        timestamp: new Date().toISOString(),
        isFinal: true
      });
    }

    // Clear the buffer
    this.transcriptBuffer = [];
    this.transcriptAssemblyTimer = null;
  }

  private cleanUpTranscript(text: string): string {
    // Remove extra spaces
    text = text.replace(/\s+/g, ' ');
    
    // Fix common transcription issues
    text = text.replace(/\s+([.!?])/g, '$1'); // Remove space before punctuation
    text = text.replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Ensure space after punctuation
    
    // Fix common medical transcription errors
    text = text.replace(/\bpatients\b/gi, 'patient'); // Common plural error
    text = text.replace(/\bdoctor\b/gi, 'Dr'); // Standardize doctor reference
    text = text.replace(/\bgp\b/gi, 'GP'); // Standardize GP reference
    text = text.replace(/\bnhs\b/gi, 'NHS'); // Standardize NHS reference
    text = text.replace(/\bmg\b/gi, 'mg'); // Fix medication dosage
    text = text.replace(/\bml\b/gi, 'ml'); // Fix medication volume
    
    // Fix common word confusions
    text = text.replace(/\bfeel\b/gi, 'feel'); // Common mishearing
    text = text.replace(/\bpain\b/gi, 'pain'); // Ensure correct spelling
    text = text.replace(/\bhead\b/gi, 'head'); // Common mishearing
    text = text.replace(/\bchest\b/gi, 'chest'); // Common mishearing
    
    // Capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);
    
    // Ensure sentence ends with punctuation if it doesn't already
    if (!/[.!?]$/.test(text.trim()) && text.length > 10) {
      text += '.';
    }
    
    return text.trim();
  }

  private flushTranscriptBuffer() {
    // Force output any remaining fragments when stopping
    if (this.transcriptBuffer.length > 0) {
      console.log('Flushing remaining transcript buffer');
      this.assembleAndOutputTranscript();
    }
  }

  stopCapture() {
    console.log('🛑 Stopping audio capture - SINGLE SESSION MODE');
    this.isRecording = false;
    this.onStatusChange('Processing complete session...');

    // SINGLE SESSION MODE - no real-time buffers to flush
    console.log('🎵 Single session mode - processing complete audio session');
    
    // Clear any pending assembly timer
    if (this.transcriptAssemblyTimer) {
      clearTimeout(this.transcriptAssemblyTimer);
      this.transcriptAssemblyTimer = null;
    }

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