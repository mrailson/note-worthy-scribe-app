import { BrowserSpeechTranscriber } from './BrowserSpeechTranscriber';

export interface SimplifiedHybridData {
  text: string;
  isFinal: boolean;
  source: 'microphone' | 'speaker';
  timestamp: number;
}

export interface SimplifiedHybridConfig {
  onTranscript?: (data: SimplifiedHybridData) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onCombinedTranscript?: (transcript: string) => void;
}

export class SimplifiedHybridTranscriber {
  private micTranscriber: BrowserSpeechTranscriber | null = null;
  private speakerTranscriber: BrowserSpeechTranscriber | null = null;
  private isActive = false;
  private combinedTranscript = '';
  private microphoneBuffer = '';
  private speakerBuffer = '';

  constructor(private config: SimplifiedHybridConfig = {}) {}

  async startTranscription(): Promise<void> {
    if (this.isActive) {
      throw new Error('Transcription already active');
    }

    try {
      this.config.onStatusChange?.('Starting simplified hybrid transcription...');
      this.isActive = true;
      this.combinedTranscript = '';
      this.microphoneBuffer = '';
      this.speakerBuffer = '';

      // Start microphone transcriber
      this.micTranscriber = new BrowserSpeechTranscriber(
        (data) => this.handleMicrophoneTranscript(data),
        (error) => console.log('Microphone transcription error:', error),
        (status) => console.log('Microphone status:', status)
      );

      // Start speaker transcriber (will try to capture computer audio)
      this.speakerTranscriber = new BrowserSpeechTranscriber(
        (data) => this.handleSpeakerTranscript(data),
        (error) => console.log('Speaker transcription error:', error),
        (status) => console.log('Speaker status:', status)
      );

      // Start both transcribers
      await this.micTranscriber.startTranscription();
      
      // Try to start speaker transcription, but don't fail if it doesn't work
      try {
        await this.speakerTranscriber.startTranscription();
        this.config.onStatusChange?.('Hybrid transcription active - mic + speaker (browser)');
      } catch (error) {
        console.log('Speaker transcription not available, using microphone only');
        this.config.onStatusChange?.('Transcription active - microphone only');
      }

    } catch (error) {
      console.error('Error starting simplified hybrid transcription:', error);
      this.cleanup();
      throw error;
    }
  }

  private handleMicrophoneTranscript(data: any): void {
    const hybridData: SimplifiedHybridData = {
      text: data.text,
      isFinal: data.isFinal,
      source: 'microphone',
      timestamp: Date.now()
    };

    this.config.onTranscript?.(hybridData);

    if (data.isFinal) {
      this.microphoneBuffer += `[MIC] ${data.text} `;
      this.updateCombinedTranscript();
    }
  }

  private handleSpeakerTranscript(data: any): void {
    const hybridData: SimplifiedHybridData = {
      text: data.text,
      isFinal: data.isFinal,
      source: 'speaker',
      timestamp: Date.now()
    };

    this.config.onTranscript?.(hybridData);

    if (data.isFinal && data.text.trim()) {
      this.speakerBuffer += `[SPEAKER] ${data.text} `;
      this.updateCombinedTranscript();
    }
  }

  private updateCombinedTranscript(): void {
    this.combinedTranscript = this.microphoneBuffer + this.speakerBuffer;
    this.config.onCombinedTranscript?.(this.combinedTranscript);
  }

  async stopTranscription(): Promise<void> {
    if (!this.isActive) return;

    this.config.onStatusChange?.('Stopping hybrid transcription...');

    try {
      // Stop both transcribers
      await this.micTranscriber?.stopTranscription();
      await this.speakerTranscriber?.stopTranscription();

      this.cleanup();
      this.config.onStatusChange?.('Hybrid transcription stopped');

    } catch (error) {
      console.error('Error stopping hybrid transcription:', error);
      this.config.onError?.(`Error stopping transcription: ${error}`);
    }
  }

  private cleanup(): void {
    this.isActive = false;
    this.micTranscriber = null;
    this.speakerTranscriber = null;
  }

  getTranscriptionStatus(): boolean {
    return this.isActive;
  }

  getCombinedTranscript(): string {
    return this.combinedTranscript;
  }
}