import { BrowserSpeechTranscriber } from './BrowserSpeechTranscriber';
import { SpeakerOnlyRecorder } from './SpeakerOnlyRecorder';

export interface HybridTranscriptData {
  text: string;
  isFinal: boolean;
  source: 'microphone' | 'speaker';
  timestamp: number;
}

export interface HybridTranscriberConfig {
  onTranscript?: (data: HybridTranscriptData) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onCombinedTranscript?: (transcript: string) => void;
}

export class HybridTranscriber {
  private browserTranscriber: BrowserSpeechTranscriber | null = null;
  private speakerRecorder: SpeakerOnlyRecorder | null = null;
  private isActive = false;
  private combinedTranscript = '';
  private microphoneBuffer = '';
  private speakerBuffer = '';

  constructor(private config: HybridTranscriberConfig = {}) {}

  async startTranscription(): Promise<void> {
    if (this.isActive) {
      throw new Error('Transcription already active');
    }

    try {
      this.config.onStatusChange?.('Starting hybrid transcription...');
      this.isActive = true;
      this.combinedTranscript = '';
      this.microphoneBuffer = '';
      this.speakerBuffer = '';

      // Start browser speech recognition for microphone
      this.browserTranscriber = new BrowserSpeechTranscriber(
        (data) => this.handleMicrophoneTranscript(data),
        (error) => this.config.onError?.(`Microphone error: ${error}`),
        (status) => console.log('Microphone status:', status)
      );

      // Start speaker-only recorder for system audio
      this.speakerRecorder = new SpeakerOnlyRecorder({
        onTranscript: (transcript, isFinal) => this.handleSpeakerTranscript(transcript, isFinal),
        onStatusChange: (status) => console.log('Speaker status:', status),
        onError: (error) => this.config.onError?.(`Speaker error: ${error}`)
      });

      // Start both transcribers
      await Promise.all([
        this.browserTranscriber.startTranscription(),
        this.speakerRecorder.startRecording()
      ]);

      this.config.onStatusChange?.('Hybrid transcription active - mic + speaker');

    } catch (error) {
      console.error('Error starting hybrid transcription:', error);
      this.cleanup();
      throw error;
    }
  }


  private handleMicrophoneTranscript(data: any): void {
    const hybridData: HybridTranscriptData = {
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

  private handleSpeakerTranscript(transcript: string, isFinal: boolean): void {
    const hybridData: HybridTranscriptData = {
      text: transcript,
      isFinal,
      source: 'speaker',
      timestamp: Date.now()
    };

    this.config.onTranscript?.(hybridData);

    if (isFinal && transcript.trim()) {
      this.speakerBuffer += `[SPEAKER] ${transcript} `;
      this.updateCombinedTranscript();
    }
  }

  private updateCombinedTranscript(): void {
    // Combine microphone and speaker transcripts chronologically
    // For now, simple concatenation - could be enhanced with timestamps
    this.combinedTranscript = this.microphoneBuffer + this.speakerBuffer;
    this.config.onCombinedTranscript?.(this.combinedTranscript);
  }

  async stopTranscription(): Promise<void> {
    if (!this.isActive) return;

    this.config.onStatusChange?.('Stopping hybrid transcription...');

    try {
      // Stop both transcribers
      await Promise.all([
        this.browserTranscriber?.stopTranscription(),
        this.speakerRecorder?.stopRecording()
      ]);

      this.cleanup();
      this.config.onStatusChange?.('Hybrid transcription stopped');

    } catch (error) {
      console.error('Error stopping hybrid transcription:', error);
      this.config.onError?.(`Error stopping transcription: ${error}`);
    }
  }

  private cleanup(): void {
    this.isActive = false;
    this.browserTranscriber = null;
    this.speakerRecorder = null;
  }

  getTranscriptionStatus(): boolean {
    return this.isActive;
  }

  getCombinedTranscript(): string {
    return this.combinedTranscript;
  }
}