import { OpenAIRealtimeRecorder } from './OpenAIRealtimeRecorder';

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
  private openAIRecorder: OpenAIRealtimeRecorder;

  constructor(config: HybridTranscriberConfig = {}) {
    // Use the working OpenAI Realtime Recorder that captures both mic and speaker
    this.openAIRecorder = new OpenAIRealtimeRecorder({
      onTranscript: (transcript, isFinal) => {
        // Since OpenAI captures both, we'll label it as combined
        config.onTranscript?.({
          text: transcript,
          isFinal,
          source: 'microphone', // Default to microphone as primary source
          timestamp: Date.now()
        });
        
        if (isFinal) {
          config.onCombinedTranscript?.(transcript);
        }
      },
      onStatusChange: config.onStatusChange,
      onError: config.onError
    });
  }

  async startTranscription(): Promise<void> {
    return this.openAIRecorder.startRecording();
  }

  async stopTranscription(): Promise<void> {
    return this.openAIRecorder.stopRecording();
  }

  getTranscriptionStatus(): boolean {
    return this.openAIRecorder.getRecordingStatus();
  }

  getCombinedTranscript(): string {
    // The OpenAI recorder handles the combined transcript internally
    return '';
  }
}