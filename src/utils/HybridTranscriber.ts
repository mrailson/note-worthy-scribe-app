import { SimplifiedHybridTranscriber, SimplifiedHybridData, SimplifiedHybridConfig } from './SimplifiedHybridTranscriber';

// Re-export for backward compatibility
export type HybridTranscriptData = SimplifiedHybridData;
export type HybridTranscriberConfig = SimplifiedHybridConfig;
export { SimplifiedHybridTranscriber as HybridTranscriber };