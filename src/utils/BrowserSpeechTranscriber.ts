import { withDefaultThresholds, meetsConfidenceThreshold } from './confidenceGating';
import { ChunkStatus } from '@/hooks/useChunkTracker';
import { supabase } from '@/integrations/supabase/client';

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
  private isPaused = false;
  private chunkCounter = 0;
  private restartTimeout: NodeJS.Timeout | null = null;
  private isRestarting = false;
  private isiOSDevice = false;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private meetingId?: string,
    private sessionId?: string,
    private userId?: string,
    private onChunkTracked?: (chunk: Omit<ChunkStatus, 'id' | 'wordCount'>) => void
  ) {}

  async startTranscription() {
    try {
      // Check for iOS/iPhone specifically - iOS Safari doesn't support continuous mode
      this.isiOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      console.log('🔍 Device detection:', { 
        isIOS: this.isiOSDevice, 
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
        throw new Error('Speech recognition not supported in this browser. Please try Chrome, Edge, or Safari.');
      }

      this.onStatusChange('Connecting...');
      console.log('🚀 Starting browser speech recognition...');

      this.recognition = new SpeechRecognition();
      
      // iOS Safari doesn't support continuous mode - it causes immediate failure
      // For iOS, we disable continuous and handle auto-restart in onend
      this.recognition.continuous = !this.isiOSDevice;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-GB';

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.onStatusChange('Recording');
        console.log('✅ Speech recognition started, continuous:', !this.isiOSDevice);
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
              const settings = withDefaultThresholds({});
              const passesConfidence = meetsConfidenceThreshold(transcriptData.confidence, settings);
              const isHallucination = this.isLikelyHallucination(transcript.toLowerCase());
              
              console.log('📊 Processing final transcript:', {
                text: transcript.substring(0, 50) + '...',
                confidence: transcriptData.confidence,
                hallucination: isHallucination,
                passesConfidence
              });

              // Always send transcription for better user experience
              this.onTranscription(transcriptData);
              
              // Track all chunks
              this.onChunkTracked?.({
                timestamp: new Date(),
                text: transcript,
                confidence: transcriptData.confidence,
                status: (!isHallucination && passesConfidence) ? 'success' : 
                       (isHallucination ? 'filtered' : 'low_confidence'),
                reason: isHallucination ? 'hallucination' : 
                       (!passesConfidence ? 'low_confidence' : undefined),
                speaker: transcriptData.speaker,
                isFinal: true
              });
              
              // Send to summarizer if quality is good
              if (!isHallucination && passesConfidence && this.onSummary) {
                this.sendToSummarizer(transcript);
              }
              
              // Save problematic chunks for analysis
              if (isHallucination || !passesConfidence) {
                const reason = isHallucination ? 'hallucination' : 'low_confidence';
                console.log('🗃️ Saving filtered chunk:', transcript, 'Confidence:', transcriptData.confidence);
                this.saveLowConfidenceChunk(transcript, transcriptData.confidence, reason);
              }
            } else {
              // Send interim results for live display
              this.onTranscription(transcriptData);
            }
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error, event.message);
        
        // Handle different error types
        if (event.error === 'aborted') {
          // Aborted errors often indicate conflicts - stop restart attempts
          this.clearRestartTimeout();
          this.isRestarting = false;
          console.log('🚫 Speech recognition aborted - stopping restart attempts');
          return;
        }
        
        // Handle specific error cases more gracefully
        switch (event.error) {
          case 'no-speech':
            console.log('⏸️ No speech detected - this is normal during silence');
            break;
          case 'audio-capture':
            this.onError('Microphone access error - please check permissions');
            break;
          case 'not-allowed':
            this.onError('Microphone permission denied - please allow microphone access');
            break;
          case 'network':
            this.onError('Network error during speech recognition');
            break;
          default:
            this.onError(`Speech recognition error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        console.log('🔄 Speech recognition ended, isRecording:', this.isRecording, 'iOS:', this.isiOSDevice);
        
        if (this.isRecording && !this.isPaused) {
          // On iOS, restart immediately to simulate continuous mode
          if (this.isiOSDevice && this.recognition) {
            console.log('🔄 iOS: Restarting recognition immediately');
            try {
              this.recognition.start();
              return;
            } catch (e) {
              console.log('🔄 iOS: Could not restart immediately, scheduling restart');
            }
          }
          
          // For non-iOS or if immediate restart failed, use scheduled restart
          if (!this.isRestarting) {
            console.log('🔄 Scheduling restart...');
            this.scheduleRestart();
          }
        } else {
          console.log('🛑 Speech recognition ended (stopped by user or paused)');
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
    this.clearRestartTimeout();
    this.isRestarting = false;
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    this.onStatusChange('Stopped');
  }

  pauseTranscription() {
    console.log('⏸️ Pausing browser speech recognition...');
    this.isPaused = true;
    this.clearRestartTimeout();
    this.isRestarting = false;
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    this.onStatusChange('Paused');
  }

  resumeTranscription() {
    console.log('▶️ Resuming browser speech recognition...');
    if (this.isRecording && this.isPaused) {
      this.isPaused = false;
      this.startTranscription();
    }
  }

  private clearRestartTimeout() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }

  private scheduleRestart() {
    // Clear any existing restart timeout first
    this.clearRestartTimeout();
    this.isRestarting = true;
    
    this.restartTimeout = setTimeout(() => {
      if (this.isRecording && !this.recognition) {
        try {
          this.startTranscription();
          console.log('✅ Speech recognition restarted');
        } catch (err) {
          console.error('Failed to restart speech recognition:', err);
          this.onError('Failed to restart speech recognition');
        }
      }
      this.isRestarting = false;
      this.restartTimeout = null;
    }, 1000); // Increased delay to prevent conflicts
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
