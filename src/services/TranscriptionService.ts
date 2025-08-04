import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export interface TranscriptionServiceOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface TranscriptionServiceCallbacks {
  onTranscript?: (data: TranscriptData) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class TranscriptionService {
  private recognition: any | null = null;
  private isActive = false;
  private callbacks: TranscriptionServiceCallbacks;
  private options: TranscriptionServiceOptions;

  constructor(callbacks: TranscriptionServiceCallbacks = {}, options: TranscriptionServiceOptions = {}) {
    this.callbacks = callbacks;
    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      ...options
    };
  }

  async startTranscription(): Promise<void> {
    try {
      this.callbacks.onStatusChange?.('connecting');

      // Check if browser supports speech recognition
      if (!this.isBrowserSupported()) {
        throw new Error('Speech recognition not supported in this browser');
      }

      this.setupSpeechRecognition();
      this.recognition!.start();
      this.isActive = true;
      this.callbacks.onStatusChange?.('connected');

    } catch (error) {
      this.callbacks.onError?.(`Failed to start transcription: ${error}`);
      this.callbacks.onStatusChange?.('error');
      throw error;
    }
  }

  private isBrowserSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  private setupSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = this.options.continuous!;
    this.recognition.interimResults = this.options.interimResults!;
    this.recognition.lang = this.options.language!;

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;

        const transcriptData: TranscriptData = {
          text: transcript,
          speaker: 'Speaker 1', // Default speaker
          confidence,
          timestamp: new Date().toISOString(),
          isFinal: result.isFinal
        };

        this.callbacks.onTranscript?.(transcriptData);
      }
    };

    this.recognition.onerror = (event) => {
      this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
      this.callbacks.onStatusChange?.('error');
    };

    this.recognition.onend = () => {
      if (this.isActive) {
        // Restart recognition if it was stopped unexpectedly
        setTimeout(() => {
          if (this.isActive) {
            this.recognition?.start();
          }
        }, 100);
      }
    };
  }

  stopTranscription(): void {
    try {
      this.isActive = false;
      if (this.recognition) {
        this.recognition.stop();
        this.recognition = null;
      }
      this.callbacks.onStatusChange?.('disconnected');
    } catch (error) {
      this.callbacks.onError?.(`Error stopping transcription: ${error}`);
    }
  }

  // Alternative transcription using Whisper API
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptData> {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio_data: base64Audio }
      });

      if (error) throw error;

      return {
        text: data.text || '',
        speaker: 'Speaker 1',
        confidence: 0.9,
        timestamp: new Date().toISOString(),
        isFinal: true
      };

    } catch (error) {
      throw new Error(`Whisper transcription failed: ${error}`);
    }
  }

  isTranscribing(): boolean {
    return this.isActive;
  }

  // Clean and format transcript text
  cleanTranscript(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\b(um|uh|er|ah)\b/gi, '') // Remove filler words
      .replace(/\s+/g, ' ') // Clean up spaces again
      .trim();
  }
}
