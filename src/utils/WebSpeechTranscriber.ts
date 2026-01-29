import { withDefaultThresholds, meetsConfidenceThreshold } from './confidenceGating';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class WebSpeechTranscriber {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private sessionId: string;
  private chunkCounter = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private meetingId?: string,
    private userId?: string
  ) {
    this.sessionId = meetingId || `webspeech_${Date.now()}`;
  }

  async startTranscription() {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Web Speech API not supported in this browser');
      }

      this.onStatusChange('Initializing...');
      console.log('🚀 Starting Web Speech API transcription...');

      // Get microphone access with enhanced audio processing
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      // Set up audio analysis for better voice detection
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Configure speech recognition
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      // Set maxAlternatives if supported
      if ('maxAlternatives' in this.recognition) {
        (this.recognition as any).maxAlternatives = 3;
      }

      // Enhanced event handlers
      this.recognition.onstart = () => {
        this.isRecording = true;
        this.onStatusChange('Recording');
        console.log('✅ Web Speech API recognition started');
      };

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript.trim();
          
          if (transcript) {
            console.log('📝 Web Speech Transcription:', transcript, 'Final:', result.isFinal);
            
            // Process both interim and final results for better real-time feedback
            const transcriptData: TranscriptData = {
              text: transcript,
              is_final: result.isFinal,
              confidence: result[0].confidence || 0.85,
              speaker: 'Speaker'
            };

            // Enhanced filtering for better quality
            if (result.isFinal) {
              const settings = withDefaultThresholds({});
              if (!this.isLikelyHallucination(transcript.toLowerCase()) && meetsConfidenceThreshold(transcriptData.confidence, settings)) {
                this.onTranscription(transcriptData);
                
                // Send to summarizer if available
                if (this.onSummary) {
                  this.sendToSummarizer(transcript);
                }
              } else {
                console.log('🗃️ Saving low-confidence chunk:', transcript, 'Confidence:', transcriptData.confidence);
                // Save to low-confidence chunks instead of discarding
                this.saveLowConfidenceChunk(transcript, transcriptData.confidence, 
                  this.isLikelyHallucination(transcript.toLowerCase()) ? 'hallucination' : 'low_confidence');
              }
            } else if (!result.isFinal) {
              // Also send interim results for live display
              this.onTranscription({
                ...transcriptData,
                confidence: Math.max(transcriptData.confidence * 0.7, 0.5) // Lower confidence for interim
              });
            }
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.error('❌ Web Speech API error:', event.error);
        
        // Handle specific error types
        switch (event.error) {
          case 'network':
            this.onError('Network error - please check your internet connection');
            break;
          case 'not-allowed':
            this.onError('Microphone access denied - please allow microphone permissions');
            break;
          case 'no-speech':
            console.log('ℹ️ No speech detected, continuing...');
            // Don't treat no-speech as a fatal error
            break;
          case 'audio-capture':
            this.onError('Audio capture error - please check your microphone');
            break;
          default:
            this.onError(`Speech recognition error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        console.log('🔄 Web Speech API ended, restarting...');
        if (this.isRecording) {
          // Automatically restart with exponential backoff
          this.restartWithBackoff();
        }
      };

      this.recognition.start();

    } catch (error) {
      console.error('Error starting Web Speech API:', error);
      this.onError(`Failed to start Web Speech API: ${error}`);
    }
  }

  private restartWithBackoff(attempt = 1) {
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5 seconds
    
    setTimeout(() => {
      if (this.isRecording && this.recognition) {
        try {
          this.recognition.start();
        } catch (error) {
          console.log(`⚠️ Restart attempt ${attempt} failed:`, error);
          if (attempt < 3) {
            this.restartWithBackoff(attempt + 1);
          } else {
            this.onError('Failed to restart speech recognition after multiple attempts');
          }
        }
      }
    }, delay);
  }

  stopTranscription() {
    console.log('🛑 Stopping Web Speech API transcription...');
    this.isRecording = false;
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private isLikelyHallucination(text: string): boolean {
    // Enhanced hallucination detection
    const exactHallucinations = [
      'bye', 'bye-bye', 'bye bye', 'goodbye',
      'thank you', 'thanks', 'thank you very much', 
      'thank you for listening', 'thank you for joining',
      'thank you for watching', 'thank you for your time',
      'good night', 'goodnight', 'good morning', 'good afternoon',
      'thank you. bye', 'thank you. bye.', 'thanks. bye',
      'thanks. bye.', 'thank you, bye', 'thanks, bye',
      'you', 'the', 'and', 'a', 'an', 'i', 'it', 'is',
      'um', 'uh', 'hmm', 'yeah', 'yes', 'no', 'ok', 'okay'
    ];

    // Check exact matches
    if (exactHallucinations.includes(text)) {
      return true;
    }

    // Filter extremely short transcripts
    if (text.length < 3) {
      return true;
    }

    // Filter extremely repetitive patterns
    const words = text.split(' ');
    if (words.length >= 3) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) {
        return true;
      }
    }

    // Filter common false positives
    const falsePositivePatterns = [
      /^[aeiou]+$/i, // Just vowels
      /^[^aeiou]+$/i, // Just consonants
      /^(.)\1{3,}/, // Repeated characters
      /^\s*$/,       // Just whitespace
    ];

    return falsePositivePatterns.some(pattern => pattern.test(text));
  }

  private async sendToSummarizer(text: string) {
    try {
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/realtime-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
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
          sessionId: this.sessionId,
          action: 'clear'
        }),
      });
    } catch (error) {
      console.error('Error clearing summary:', error);
    }
  }

  // Get audio level for visual feedback
  getAudioLevel(): number {
    if (!this.analyser) return 0;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength / 255; // Normalize to 0-1
  }

  private async saveLowConfidenceChunk(text: string, confidence: number, filterReason: string) {
    if (!this.meetingId || !this.userId) {
      console.warn('Cannot save low-confidence chunk: missing meetingId or userId');
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
          transcriber_type: 'web_speech',
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

// Type declarations for Web Speech API
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