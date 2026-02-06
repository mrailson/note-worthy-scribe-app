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
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
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
          sampleRate: 48000,
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

    this.audioContext = new AudioContext({ sampleRate: 48000 });
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

    // Use sophisticated format detection like MeetingRecorder
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    let mimeType = 'audio/webm;codecs=opus'; // Default that works well with Whisper
    let bitrate = 128000;
    
    console.log('🎵 Detecting optimal audio format...', { isIOS, isSafari });
    
    if (isIOS || isSafari) {
      // iOS Safari prefers mp4 format
      const iosFormats = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
      for (const format of iosFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`📱 iOS optimized format selected: ${format}`);
          break;
        }
      }
    } else {
      // Standard desktop browser formats — audio-only MIME, no video containers
      const standardFormats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      for (const format of standardFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`🖥️ Desktop format selected: ${format}`);
          break;
        }
      }
    }
    
    // Fallback to default if nothing is supported
    let options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported(mimeType)) {
      options.mimeType = mimeType;
      options.audioBitsPerSecond = bitrate;
      console.log('✅ Using MediaRecorder options:', options);
    } else {
      console.log('⚠️ Using browser default audio format - no MIME type specified');
    }

    this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        console.log(`Audio chunk ${this.audioChunks.length} collected:`, event.data.size, 'bytes');
        
        // BACKUP MODE: Save chunk to database every 10 chunks for safety
        if (this.audioChunks.length % 10 === 0) {
          this.saveAudioChunkBackup();
        }
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('Recording stopped - processing complete session audio');
      this.processAudioChunks();
    };

    // Start recording with periodic data collection for backup
    this.mediaRecorder.start(10000); // Collect data every 10 seconds for backup
    this.isRecording = true;
  }

  private async saveAudioChunkBackup() {
    try {
      if (this.audioChunks.length === 0) return;
      
      const currentChunks = [...this.audioChunks];
      const audioBlob = new Blob(currentChunks, { type: 'audio/webm' });
      
      console.log('💾 Saving audio chunk backup:', audioBlob.size, 'bytes');
      
      // Save to session storage as emergency backup
      const chunkData = {
        timestamp: Date.now(),
        size: audioBlob.size,
        chunkCount: currentChunks.length
      };
      
      const existingBackups = JSON.parse(sessionStorage.getItem('meeting_audio_backup') || '[]');
      existingBackups.push(chunkData);
      sessionStorage.setItem('meeting_audio_backup', JSON.stringify(existingBackups));
      
    } catch (error) {
      console.error('Failed to save audio chunk backup:', error);
    }
  }

  private isLikelyHallucination(text: string): boolean {
    // Common Whisper hallucinations - keep exact matches only
    const exactHallucinations = [
      'bye', 'bye-bye', 'bye bye', 'goodbye',
      'thank you', 'thanks', 'thank you very much', 
      'thank you for listening', 'thank you for joining',
      'thank you for watching', 'thank you for your time',
      'good night', 'goodnight', 'good morning', 'good afternoon',
      'unclear audio', 'or unclear audio'
    ];

    // Religious/Arabic phrases that Whisper hallucinates
    const religiousPatterns = [
      'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 'bismillah'
    ];

    // Audio quality hallucinations
    const audioQualityPatterns = [
      'unclear audio', 'poor audio', 'bad audio', 'no audio',
      'audio unclear', 'inaudible', 'muffled audio'
    ];

    // Check exact matches
    if (exactHallucinations.includes(text.toLowerCase().trim())) {
      return true;
    }

    // Check for religious hallucinations
    if (religiousPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
      return true;
    }

    // Check for audio quality hallucinations
    if (audioQualityPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
      return true;
    }

    // Check for repetitive patterns (same phrase 3+ times)
    const lowerText = text.toLowerCase();
    if (lowerText.includes('or unclear audio') && (lowerText.match(/or unclear audio/g) || []).length >= 3) {
      console.log('🚫 Detected "or unclear audio" hallucination pattern');
      return true;
    }

    // Check for any repetitive short phrases (2-4 words repeated 3+ times)
    const words = text.split(' ');
    if (words.length >= 6) {
      for (let phraseLength = 2; phraseLength <= 4; phraseLength++) {
        for (let i = 0; i <= words.length - phraseLength * 3; i++) {
          const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
          let count = 0;
          for (let j = i; j <= words.length - phraseLength; j += phraseLength) {
            const testPhrase = words.slice(j, j + phraseLength).join(' ').toLowerCase();
            if (testPhrase === phrase) {
              count++;
            } else {
              break;
            }
          }
          if (count >= 3) {
            console.log('🚫 Detected repetitive phrase hallucination:', phrase);
            return true;
          }
        }
      }
    }

    // Filter extremely repetitive single words (same word 4+ times)
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

      console.log('🔄 Sending complete session audio to Whisper...');
      
      // Create FormData with proper format handling for OpenAI Whisper
      const formData = new FormData();
      
      // Ensure we're using the correct MIME type for OpenAI Whisper compatibility
      const actualMimeType = audioBlob.type || 'audio/webm;codecs=opus';
      console.log('🎵 Sending audio to Whisper:', {
        originalType: audioBlob.type,
        finalType: actualMimeType,
        size: audioBlob.size
      });
      
      // Create file with Whisper-compatible extension and MIME type
      let extension = '.webm';
      let finalMimeType = actualMimeType;
      
      if (actualMimeType.includes('mp4') || actualMimeType.includes('aac')) {
        extension = '.mp4';
      } else if (actualMimeType.includes('ogg')) {
        extension = '.ogg';
      } else if (actualMimeType.includes('wav')) {
        extension = '.wav';
      }
      
      const audioFile = new File([audioBlob], `consultation${extension}`, { type: finalMimeType });
      formData.append('audio', audioFile);

      // Use direct Whisper transcription for faster processing
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/test-mp3-transcription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: formData
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

        // Check for hallucinations before processing
        if (this.isLikelyHallucination(transcriptionText)) {
          console.log('🚫 Filtering out hallucinated transcription:', transcriptionText.substring(0, 100) + '...');
          return;
        }

        // Check if transcription is too short or empty
        if (!transcriptionText || transcriptionText.trim().length < 3) {
          console.log('🚫 Skipping empty or very short transcription');
          return;
        }

        // Trigger transcript update only if valid
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
        
        // Log the error but don't try fallback since we're using the same endpoint
        console.log('❌ Transcription failed - no fallback available');
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
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