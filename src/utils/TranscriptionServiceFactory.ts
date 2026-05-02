import { 
  TranscriptionService, 
  TranscriptionCallbacks
} from '@/types/transcriptionServices';
import { AssemblyAIRealtimeTranscriber } from '@/utils/AssemblyAIRealtimeTranscriber';
import { DeepgramRealtimeTranscriber } from '@/utils/DeepgramRealtimeTranscriber';
import { AmazonTranscribeRealtimeTranscriber } from '@/utils/AmazonTranscribeRealtimeTranscriber';
import { GoogleCloudSpeechTranscriber } from '@/utils/GoogleCloudSpeechTranscriber';
import { BrowserSpeechTranscriber } from '@/utils/BrowserSpeechTranscriber';
import { WhisperBatchTranscriber } from '@/utils/WhisperBatchTranscriber';


// Unified interface that all transcribers implement
export interface UnifiedTranscriber {
  startTranscription(): Promise<void>;
  stopTranscription(): void;
}

/**
 * Factory function to create the appropriate transcriber based on service selection
 */
export function createTranscriber(
  service: TranscriptionService,
  callbacks: TranscriptionCallbacks
): UnifiedTranscriber {
  const { onTranscription, onError, onStatusChange, onSummary } = callbacks;
  
  console.log(`🏭 Creating transcriber for service: ${service}`);
  
  switch (service) {
    case 'assemblyai':
      return new AssemblyAIRealtimeTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );
      
    case 'deepgram':
      return new DeepgramRealtimeTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );
      
    case 'amazon-transcribe':
      return new AmazonTranscribeRealtimeTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );
      
    case 'google-cloud':
      return new GoogleCloudSpeechTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );
      
    case 'whisper-batch':
      return new WhisperBatchTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );



    default:
      console.warn(`Unknown service: ${service}, falling back to AssemblyAI`);
      return new AssemblyAIRealtimeTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );
  }
}

/**
 * Get the display name for a transcription service
 */
export function getServiceDisplayName(service: TranscriptionService): string {
  const names: Record<TranscriptionService, string> = {
    'assemblyai': 'AssemblyAI',
    'deepgram': 'Deepgram Nova-3',
    'amazon-transcribe': 'Amazon Transcribe',
    'google-cloud': 'Google Cloud Speech',
    'whisper-batch': 'Whisper (Batch)',
  };
  return names[service] || service;
}

/**
 * Check if a service is a batch (non-realtime) service
 */
export function isBatchService(service: TranscriptionService): boolean {
  return service === 'whisper-batch';
}
