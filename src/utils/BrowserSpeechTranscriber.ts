export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class BrowserSpeechTranscriber {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private chunkCounter = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private meetingId?: string,
    private sessionId?: string,
    private userId?: string
  ) {}

  async startTranscription() {
    try {
      // Check for iOS/iPhone specifically
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      console.log('🔍 Device detection:', { 
        isIOS, 
        isSafari, 
        userAgent: navigator.userAgent.substring(0, 100) 
      });
      
      // Check if browser supports speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      console.log('🎤 Speech API check:', { 
        SpeechRecognition: !!SpeechRecognition,
        webkitSpeechRecognition: !!(window as any).webkitSpeechRecognition,
        SpeechRecognitionStandard: !!window.SpeechRecognition
      });
      
      if (!SpeechRecognition) {
        if (isIOS) {
          throw new Error('Speech recognition is not supported on iPhone/Safari. Please use your SmartPhone Notewell Version or Teams own recording service to record Teams meetings in the meantime');
        }
        throw new Error('Speech recognition not supported in this browser');
      }

      this.onStatusChange('Connecting...');
      console.log('🚀 Starting browser speech recognition...');

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.onStatusChange('Recording');
        console.log('✅ Speech recognition started');
      };

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          if (transcript.trim()) {
            console.log('📝 Transcription:', transcript, 'Final:', result.isFinal);
            
            const transcriptData: TranscriptData = {
              text: transcript,
              is_final: result.isFinal,
              confidence: result[0].confidence || 0.9,
              speaker: 'Speaker'
            };

            // Process both interim and final results for better UX
            // For final results: check quality and save low-confidence chunks
            if (result.isFinal) {
              if (!this.isLikelyHallucination(transcript.toLowerCase()) && transcriptData.confidence >= 0.3) {
                this.onTranscription(transcriptData);
                
                // Send to summarizer
                if (this.onSummary) {
                  this.sendToSummarizer(transcript);
                }
              } else {
                console.log('🗃️ Saving low-confidence chunk:', transcript, 'Confidence:', transcriptData.confidence);
                // Save to low-confidence chunks instead of discarding
                this.saveLowConfidenceChunk(transcript, transcriptData.confidence, 
                  this.isLikelyHallucination(transcript.toLowerCase()) ? 'hallucination' : 'low_confidence');
              }
            } else {
              // Send interim results for live display
              this.onTranscription(transcriptData);
            }
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        
        // Don't treat "no-speech" as an actual error - it's normal during silence
        if (event.error !== 'no-speech') {
          this.onError(`Speech recognition error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isRecording) {
          console.log('🔄 Speech recognition ended, restarting...');
          // Add delay to prevent infinite restart loops
          setTimeout(() => {
            if (this.isRecording && this.recognition) {
              try {
                this.recognition.start();
                console.log('✅ Speech recognition restarted');
              } catch (err) {
                console.error('Failed to restart speech recognition:', err);
                this.onError('Failed to restart speech recognition');
              }
            }
          }, 500); // 500ms delay to prevent rapid restarts
        } else {
          console.log('🛑 Speech recognition ended (stopped by user)');
        }
      };

      this.recognition.start();

    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.onError(`Failed to start speech recognition: ${error}`);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping browser speech recognition...');
    this.isRecording = false;
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private isLikelyHallucination(text: string): boolean {
    // Common speech-to-text hallucinations
    const exactHallucinations = [
      'bye', 'bye-bye', 'bye bye', 'goodbye',
      'thank you', 'thanks', 'thank you very much', 
      'thank you for listening', 'thank you for joining',
      'thank you for watching', 'thank you for your time',
      'good night', 'goodnight', 'good morning', 'good afternoon',
      'thank you. bye', 'thank you. bye.', 'thanks. bye',
      'thanks. bye.', 'thank you, bye', 'thanks, bye'
    ];

    // Check exact matches
    if (exactHallucinations.includes(text)) {
      return true;
    }

    // Filter extremely repetitive patterns
    const words = text.split(' ');
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) {
        return true;
      }
    }

    return false;
  }

  private async sendToSummarizer(text: string) {
    try {
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/realtime-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: `browser_session_${Date.now()}`,
          text: text,
          action: 'add'
        }),
      });

      const data = await response.json();
      
      if (data.success && data.action === 'summary_generated' && this.onSummary) {
        this.onSummary(data.summary);
      }
    } catch (error) {
      console.error('Error sending to summarizer:', error);
    }
  }

  async clearSummary() {
    try {
      await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/realtime-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: `browser_session_${Date.now()}`,
          action: 'clear'
        }),
      });
    } catch (error) {
      console.error('Error clearing summary:', error);
    }
  }

  private async saveLowConfidenceChunk(text: string, confidence: number, filterReason: string) {
    if (!this.meetingId || !this.sessionId || !this.userId) {
      console.warn('Cannot save low-confidence chunk: missing meetingId, sessionId, or userId');
      return;
    }

    try {
      this.chunkCounter++;
      
      // Import supabase dynamically to avoid build issues
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('low_confidence_chunks')
        .insert({
          meeting_id: this.meetingId,
          session_id: this.sessionId,
          user_id: this.userId,
          chunk_number: this.chunkCounter,
          transcription_text: text,
          confidence: confidence,
          original_confidence: confidence,
          transcriber_type: 'browser_speech',
          filter_reason: filterReason
        });

      if (error) {
        console.error('Error saving low-confidence chunk:', error);
      } else {
        console.log(`💾 Saved low-confidence chunk ${this.chunkCounter} to database`);
      }
    } catch (error) {
      console.error('Error saving low-confidence chunk:', error);
    }
  }
}

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};
