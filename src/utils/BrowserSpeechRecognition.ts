interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export class BrowserSpeechRecognition {
  private recognition: any = null;
  private isListening = false;
  private isStarting = false;
  private stoppedByUser = false;
  private currentSpeaker = 'Speaker';
  private preferredLang = 'en-GB';

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  async startRecognition() {
    if (!this.isSupported()) {
      this.onError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Android Chrome.');
      return;
    }

    // Prevent double starts
    if (this.isListening || this.isStarting) {
      console.log('ℹ️ Recognition already active or starting, skipping start');
      return;
    }

    try {
      // Ensure mic permission is granted before starting
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone permission granted');
      } catch (permErr) {
        console.error('❌ Microphone permission error:', permErr);
        this.onError('Microphone permission denied or unavailable');
        return;
      }

      // @ts-ignore
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      // Configure recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.preferredLang; // Use preferred language
      this.recognition.maxAlternatives = 1;

      // Handle results
      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.9;
          const isFinal = result.isFinal;

          if (transcript.trim()) {
            this.onTranscript({
              text: transcript,
              speaker: this.currentSpeaker,
              confidence: confidence,
              timestamp: new Date().toISOString(),
              isFinal: isFinal
            });
          }
        }
      };

      // Handle start
      this.recognition.onstart = () => {
        this.isListening = true;
        this.isStarting = false;
        this.stoppedByUser = false;
        this.onStatusChange('Listening for speech...');
        console.log('Speech recognition started');
      };

      // Handle end
      this.recognition.onend = () => {
        if (this.isListening && !this.stoppedByUser) {
          // Restart if we're supposed to be listening
          console.log('Speech recognition ended, restarting...');
          setTimeout(() => {
            if (this.isListening && !this.isStarting) {
              try {
                this.isStarting = true;
                this.recognition.start();
              } catch (e) {
                console.warn('Restart failed:', e);
              }
            }
          }, 300);
        } else {
          console.log('Speech recognition ended');
        }
      };

      // Handle errors
      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        switch (event.error) {
          case 'network':
            this.onError('Network error during speech recognition');
            break;
          case 'not-allowed':
            this.onError('Microphone permission denied');
            break;
          case 'no-speech':
            // Don't treat no-speech as an error, just continue
            console.log('No speech detected, continuing...');
            break;
          case 'aborted':
            // Happens when stop() is called or rapid restarts; not a user-facing error
            console.log('Recognition aborted (likely due to restart); continuing...');
            break;
          default:
            this.onError(`Speech recognition error: ${event.error}`);
        }
      };

      // Start recognition
      this.stoppedByUser = false;
      try {
        this.isStarting = true;
        this.recognition.start();
      } catch (e: any) {
        this.isStarting = false;
        if (e && (e.name === 'InvalidStateError' || `${e}`.includes('already started'))) {
          console.warn('Recognition already started; ignoring duplicate start');
          return;
        }
        throw e;
      }
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.onError('Failed to start speech recognition: ' + error.message);
    }
  }

  stopRecognition() {
    if (this.recognition && this.isListening) {
      this.stoppedByUser = true;
      this.isStarting = false;
      this.isListening = false;
      this.recognition.stop();
      this.onStatusChange('Speech recognition stopped');
      console.log('Speech recognition stopped');
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  async setLanguage(lang: string) {
    try {
      this.preferredLang = lang;
      if (this.recognition) {
        console.log('🌐 Switching recognition language to:', lang);
        this.recognition.lang = lang;
        if (this.isListening) {
          // Restart to apply language change reliably
          this.recognition.stop();
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn('Could not restart recognition after language change:', e);
            }
          }, 150);
        }
      }
    } catch (e) {
      console.error('Failed to set recognition language:', e);
    }
  }
}