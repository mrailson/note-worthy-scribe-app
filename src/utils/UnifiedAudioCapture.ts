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
      
      // Step 5: Send an immediate test to verify the system is working
      setTimeout(() => {
        this.sendTestAudio();
      }, 2000);
      
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

  private isLikelyHallucination(text: string): boolean {
    // Common Whisper hallucinations
    const hallucinations = [
      'bye', 'bye-bye', 'bye bye',
      'thank you', 'thanks', 'thank you very much', 'thank you for listening',
      'thank you for joining', 'thank you for watching',
      'good night', 'goodnight', 'good morning', 'good afternoon',
      'hello', 'hi there', 'welcome', 'cheers',
      'music', 'applause', 'laughter', 'silence',
      'okay', 'ok', 'um', 'uh', 'hmm',
      'you', 'me', 'i', 'we', 'they'
    ];

    // Religious/Arabic phrases that Whisper sometimes hallucinates
    const religiousPatterns = [
      'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 'bismillah'
    ];

    // Check exact matches and short phrases
    if (text.length < 4 || hallucinations.includes(text)) {
      return true;
    }

    // Check for religious hallucinations
    if (religiousPatterns.some(pattern => text.includes(pattern))) {
      return true;
    }

    // Check for repetitive patterns
    const words = text.split(' ');
    if (words.length > 1) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1 && words.length > 2) {
        return true; // Repetitive like "bye bye bye"
      }
    }

    // Check for very short responses that are likely noise
    if (text.length < 8 && words.length < 3) {
      return true;
    }

    return false;
  }

  private scheduleProcessing() {
    if (!this.isRecording) return;

    // Record in shorter chunks for faster feedback
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
    }, 1500); // Process every 1.5 seconds for faster feedback
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
      
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/speech-to-text', {
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
          // Use Whisper's quality metrics to detect hallucinations
          const segments = result.segments || [];
          
          if (segments.length > 0) {
            const avgNoSpeechProb = segments.reduce((sum: number, seg: any) => sum + (seg.no_speech_prob || 0), 0) / segments.length;
            const avgLogProb = segments.reduce((sum: number, seg: any) => sum + (seg.avg_logprob || 0), 0) / segments.length;
            
            // Reject if high probability of no speech or very low confidence
            if (avgNoSpeechProb > 0.6 || avgLogProb < -1.0) {
              console.log('Rejected transcription - poor quality metrics:', {
                no_speech_prob: avgNoSpeechProb,
                avg_logprob: avgLogProb,
                text: result.text
              });
              return;
            }
          }
          
          const text = result.text.trim();
          
          // Enhanced filtering for common hallucinations
          const lowercaseText = text.toLowerCase();
          const isHallucination = this.isLikelyHallucination(lowercaseText);
          
          if (!isHallucination) {
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

  private async sendTestAudio() {
    // Send a small test audio to verify the system is working
    // This creates a very brief silent audio to test the pipeline
    try {
      console.log('Sending test audio to verify system...');
      
      // Create a minimal test audio (1 second of silence)
      const sampleRate = 24000;
      const duration = 1; // 1 second
      const numSamples = sampleRate * duration;
      
      // Create minimal audio data
      const audioData = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(audioData);
      
      // WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples * 2, true);
      
      const uint8Array = new Uint8Array(audioData);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i += 0x8000) {
        const chunk = uint8Array.subarray(i, Math.min(i + 0x8000, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ audio: base64Audio })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Audio transcription system verified and ready!');
        this.onTranscript({
          text: 'Audio transcription system ready ✓',
          speaker: 'System',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
          isFinal: true
        });
      }
    } catch (error) {
      console.error('Test audio failed:', error);
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