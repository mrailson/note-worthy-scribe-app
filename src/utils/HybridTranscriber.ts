import { DualOpenAITranscriber, DualOpenAIConfig } from './DualOpenAITranscriber';

// Re-export for backward compatibility with existing hybrid implementation
export type HybridTranscriptData = {
  text: string;
  isFinal: boolean;
  source: 'microphone' | 'speaker';
  timestamp: number;
};

export type HybridTranscriberConfig = {
  onTranscript?: (data: HybridTranscriptData) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onCombinedTranscript?: (transcript: string) => void;
};

export class HybridTranscriber {
  private dualTranscriber: DualOpenAITranscriber;

  constructor(config: HybridTranscriberConfig = {}) {
    // Adapt the config to work with DualOpenAITranscriber
    const adaptedConfig: DualOpenAIConfig = {
      onTranscript: (transcript, isFinal, source) => {
        config.onTranscript?.({
          text: transcript,
          isFinal,
          source,
          timestamp: Date.now()
        });
      },
      onStatusChange: config.onStatusChange,
      onError: config.onError,
      onCombinedTranscript: config.onCombinedTranscript
    };

    this.dualTranscriber = new DualOpenAITranscriber(adaptedConfig);
  }

  async startTranscription(): Promise<void> {
    return this.dualTranscriber.startRecording();
  }

  async stopTranscription(): Promise<void> {
    return this.dualTranscriber.stopRecording();
  }

  getTranscriptionStatus(): boolean {
    return this.dualTranscriber.getRecordingStatus();
  }

  getCombinedTranscript(): string {
    return this.dualTranscriber.getCombinedTranscript();
  }
}