import { DeepgramRealtimeTranscriber, TranscriptData } from '@/utils/DeepgramRealtimeTranscriber';
import { BrowserSpeechRecognition } from '@/utils/BrowserSpeechRecognition';

export type TranscriptionService = 'browser' | 'deepgram';

export interface EnhancedSpeechConfig {
  service: TranscriptionService;
  language?: string;
  autoFallback?: boolean;
}

export class EnhancedSpeechRecognition {
  private currentService: TranscriptionService;
  private deepgramTranscriber: DeepgramRealtimeTranscriber | null = null;
  private browserRecognition: BrowserSpeechRecognition | null = null;
  private isActive = false;
  private hasAutoFallback: boolean;

  constructor(
    private onTranscript: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private config: EnhancedSpeechConfig = { service: 'browser', autoFallback: true }
  ) {
    this.currentService = config.service;
    this.hasAutoFallback = config.autoFallback ?? true;
    
    console.log('🎤 EnhancedSpeechRecognition initialized:', {
      service: this.currentService,
      autoFallback: this.hasAutoFallback,
      language: config.language
    });
  }

  async startRecognition(): Promise<void> {
    if (this.isActive) {
      console.log('⚠️ Recognition already active');
      return;
    }

    this.isActive = true;
    console.log(`🚀 Starting ${this.currentService} recognition...`);

    try {
      if (this.currentService === 'deepgram') {
        await this.startDeepgramRecognition();
      } else {
        await this.startBrowserRecognition();
      }
    } catch (error) {
      console.error(`❌ ${this.currentService} recognition failed:`, error);
      
      if (this.hasAutoFallback && this.currentService === 'deepgram') {
        console.log('🔄 Falling back to browser recognition...');
        this.currentService = 'browser';
        try {
          await this.startBrowserRecognition();
        } catch (fallbackError) {
          this.isActive = false;
          this.onError(`Both recognition services failed: ${fallbackError}`);
          throw fallbackError;
        }
      } else if (this.hasAutoFallback && this.currentService === 'browser') {
        console.log('🔄 Falling back to Deepgram...');
        this.currentService = 'deepgram';
        try {
          await this.startDeepgramRecognition();
        } catch (fallbackError) {
          this.isActive = false;
          this.onError(`Both recognition services failed: ${fallbackError}`);
          throw fallbackError;
        }
      } else {
        this.isActive = false;
        this.onError(`${this.currentService} recognition failed: ${error}`);
        throw error;
      }
    }
  }

  private async startDeepgramRecognition(): Promise<void> {
    this.onStatusChange('Connecting to Deepgram...');
    
    this.deepgramTranscriber = new DeepgramRealtimeTranscriber(
      (data: TranscriptData) => {
        console.log('📝 Deepgram transcript:', { text: data.text, isFinal: data.is_final });
        this.onTranscript(data);
      },
      (error: string) => {
        console.error('❌ Deepgram error:', error);
        this.onError(`Deepgram error: ${error}`);
      },
      (status: string) => {
        console.log('🎤 Deepgram status:', status);
        this.onStatusChange(`Deepgram: ${status}`);
      }
    );

    await this.deepgramTranscriber.startTranscription();
    this.onStatusChange('Deepgram: Recording');
    console.log('✅ Deepgram recognition started');
  }

  private async startBrowserRecognition(): Promise<void> {
    this.onStatusChange('Starting browser recognition...');
    
    this.browserRecognition = new BrowserSpeechRecognition(
      (transcript: any) => {
        const data: TranscriptData = {
          text: transcript.text || transcript.transcript || '',
          is_final: transcript.isFinal ?? true,
          confidence: transcript.confidence || 0.9,
          speaker: 'Speaker'
        };
        console.log('📝 Browser transcript:', { text: data.text, isFinal: data.is_final });
        this.onTranscript(data);
      },
      (error: string) => {
        console.error('❌ Browser recognition error:', error);
        this.onError(`Browser recognition error: ${error}`);
      },
      (status: string) => {
        console.log('🎤 Browser status:', status);
        this.onStatusChange(`Browser: ${status}`);
      }
    );

    if (this.config.language) {
      await this.browserRecognition.setLanguage(this.config.language);
    }

    await this.browserRecognition.startRecognition();
    this.onStatusChange('Browser: Recording');
    console.log('✅ Browser recognition started');
  }

  stopRecognition(): void {
    console.log('🛑 Stopping recognition...');
    this.isActive = false;

    if (this.deepgramTranscriber) {
      this.deepgramTranscriber.stopTranscription();
      this.deepgramTranscriber = null;
    }

    if (this.browserRecognition) {
      this.browserRecognition.stopRecognition();
      this.browserRecognition = null;
    }

    this.onStatusChange('Stopped');
    console.log('✅ Recognition stopped');
  }

  async switchService(newService: TranscriptionService): Promise<void> {
    console.log(`🔄 Switching from ${this.currentService} to ${newService}...`);
    
    const wasActive = this.isActive;
    
    if (wasActive) {
      this.stopRecognition();
    }
    
    this.currentService = newService;
    
    if (wasActive) {
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.startRecognition();
    }
    
    console.log(`✅ Switched to ${newService}`);
  }

  getCurrentService(): TranscriptionService {
    return this.currentService;
  }

  isRecording(): boolean {
    return this.isActive;
  }

  async setLanguage(language: string): Promise<void> {
    this.config.language = language;
    
    if (this.browserRecognition) {
      await this.browserRecognition.setLanguage(language);
    }
    
    // Deepgram handles language automatically based on audio
    console.log(`🌍 Language set to: ${language}`);
  }
}