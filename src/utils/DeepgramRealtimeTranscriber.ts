import { SystemAudioCapture } from '@/utils/SystemAudioCapture';
import { supabase } from '@/integrations/supabase/client';
import { BrowserSpeechTranscriber } from '@/utils/BrowserSpeechTranscriber';
export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
}

export class DeepgramRealtimeTranscriber {
  private browserTranscriber: BrowserSpeechTranscriber;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {
    this.browserTranscriber = new BrowserSpeechTranscriber(
      onTranscription,
      onError,
      onStatusChange,
      onSummary
    );
  }

  async startTranscription() {
    console.log('🎙️ Using browser speech recognition instead of edge functions');
    await this.browserTranscriber.startTranscription();
  }

  stopTranscription() {
    this.browserTranscriber.stopTranscription();
  }

  isActive(): boolean {
    return this.browserTranscriber.isActive();
  }

  async clearSummary() {
    await this.browserTranscriber.clearSummary();
  }
}