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
      
      // Get microphone access first
      let micStream: MediaStream | null = null;
      
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 44100,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('Microphone access granted');
        this.onStatusChange('Microphone connected');
      } catch (micError) {
        console.warn('Microphone access failed:', micError);
        throw new Error('Microphone access is required for recording');
      }

      // Try to capture system audio intelligently
      let systemStream: MediaStream | null = null;
      
      try {
        console.log('Attempting to capture system audio for web meetings...');
        this.onStatusChange('Detecting system audio...');
        
        // Check if we're likely in a web meeting context
        const isWebMeeting = this.detectWebMeetingContext();
        
        if (isWebMeeting) {
          console.log('Web meeting context detected, requesting system audio access');
          this.onStatusChange('Click "Share" to include meeting audio');
          
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              sampleRate: 44100,
              channelCount: 1,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
          console.log('System audio access granted');
        } else {
          console.log('No web meeting detected, using microphone only');
        }
        
      } catch (systemError) {
        console.log('System audio access declined or failed:', systemError);
        this.onStatusChange('System audio not available - using microphone only');
      }

      // Create final stream
      if (micStream && systemStream) {
        console.log('Creating mixed audio stream (mic + system)');
        this.onStatusChange('Recording microphone + system audio');
        this.stream = this.mixAudioStreams(micStream, systemStream);
      } else {
        console.log('Using microphone only');
        this.onStatusChange('Recording microphone audio');
        this.stream = micStream;
      }

      // Set up audio context for voice activity detection
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      
      // Create audio source from the mixed stream
      const audioSource = this.audioContext.createMediaStreamSource(this.stream);
      
      // Set up analyser for voice activity detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      audioSource.connect(this.analyser);
      
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
      this.onError('Audio access denied: ' + error.message);
      throw error;
    }
  }

  private detectWebMeetingContext(): boolean {
    try {
      // Check URL for common meeting platforms
      const url = window.location.href.toLowerCase();
      const meetingDomains = [
        'zoom.us', 'meet.google.com', 'teams.microsoft.com', 
        'webex.com', 'gotomeeting.com', 'skype.com',
        'whereby.com', 'jitsi.org', 'bluejeans.com'
      ];
      
      const isOnMeetingPlatform = meetingDomains.some(domain => url.includes(domain));
      
      // Check for video/audio elements that might indicate a meeting
      const mediaElements = document.querySelectorAll('video, audio');
      const hasActiveMedia = Array.from(mediaElements).some(el => {
        const media = el as HTMLMediaElement;
        return !media.paused && media.currentTime > 0;
      });
      
      // Check for WebRTC connections
      const hasWebRTC = !!(window as any).RTCPeerConnection || !!(window as any).webkitRTCPeerConnection;
      
      console.log('Meeting context detection:', {
        isOnMeetingPlatform,
        hasActiveMedia,
        hasWebRTC,
        mediaElementCount: mediaElements.length
      });
      
      return isOnMeetingPlatform || (hasActiveMedia && hasWebRTC);
      
    } catch (error) {
      console.log('Error detecting web meeting context:', error);
      return false;
    }
  }

  private mixAudioStreams(micStream: MediaStream, systemStream: MediaStream): MediaStream {
    console.log('Mixing audio streams - mic and system');
    const audioContext = new AudioContext({ sampleRate: 44100 });
    
    try {
      // Create sources for both streams
      const micSource = audioContext.createMediaStreamSource(micStream);
      const systemSource = audioContext.createMediaStreamSource(systemStream);
      
      // Create gain nodes for volume control
      const micGain = audioContext.createGain();
      const systemGain = audioContext.createGain();
      
      // Set gain levels (can adjust these for balance)
      micGain.gain.value = 0.8; // Slightly lower mic to avoid feedback
      systemGain.gain.value = 1.0; // Full system audio
      
      // Create a mixer node
      const mixer = audioContext.createGain();
      mixer.gain.value = 1.0;
      
      // Connect sources through gain controls to mixer
      micSource.connect(micGain);
      systemSource.connect(systemGain);
      micGain.connect(mixer);
      systemGain.connect(mixer);
      
      // Create a destination for the mixed audio
      const dest = audioContext.createMediaStreamDestination();
      mixer.connect(dest);
      
      console.log('Audio streams successfully mixed');
      return dest.stream;
    } catch (error) {
      console.error('Error mixing audio streams:', error);
      // Fallback to microphone only if mixing fails
      return micStream;
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
              // More conservative filtering for false positives
              const text = result.text.trim();
              const lowercaseText = text.toLowerCase();
              
              // Only filter out obvious non-speech patterns
              const falsePositives = [
                'music',
                'applause',
                'laughter',
                '♪',
                'silence'
              ];
              
              // Check for repetitive patterns (like "bye bye bye bye")
              const words = text.split(' ');
              const isRepetitive = words.length > 3 && words.every(word => word.toLowerCase() === words[0].toLowerCase());
              
              // Check if the text is likely a false positive
              const isFalsePositive = falsePositives.some(phrase => 
                lowercaseText.includes(phrase)
              ) || text.length < 3;
               
               if (!isFalsePositive && !isRepetitive && text.length > 2) {
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

  pauseTranscription() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.onStatusChange('Paused');
    }
  }

  resumeTranscription() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.onStatusChange('Recording speech...');
    }
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