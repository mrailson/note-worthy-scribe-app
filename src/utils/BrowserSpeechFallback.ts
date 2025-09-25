// Browser Speech Recognition fallback for immediate feedback
export class BrowserSpeechFallback {
  private recognition: any = null;
  private isActive = false;

  constructor(
    private onTranscript: (text: string) => void,
    private onError: (error: string) => void
  ) {
    this.setupSpeechRecognition();
  }

  private setupSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Browser speech recognition not available');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-GB';

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.onTranscript(finalTranscript);
      } else if (interimTranscript) {
        // Show interim results for immediate feedback
        this.onTranscript(interimTranscript + ' [processing...]');
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        this.onError(`Speech recognition error: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      if (this.isActive) {
        // Restart if we're still supposed to be active
        setTimeout(() => {
          if (this.isActive) {
            this.recognition.start();
          }
        }, 100);
      }
    };
  }

  start() {
    if (!this.recognition) {
      this.onError('Browser speech recognition not available');
      return;
    }

    try {
      this.isActive = true;
      this.recognition.start();
      console.log('Browser speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.onError('Failed to start browser speech recognition');
    }
  }

  stop() {
    this.isActive = false;
    if (this.recognition) {
      this.recognition.stop();
      console.log('Browser speech recognition stopped');
    }
  }

  isSupported(): boolean {
    return !!this.recognition;
  }
}