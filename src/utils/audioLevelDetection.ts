/**
 * Audio Level Detection Utilities for Phase 2 Hallucination Reduction
 * 
 * Provides RMS (Root Mean Square) audio level detection to skip silent audio chunks
 * before sending to Whisper, preventing hallucinations during silence.
 */

/**
 * Calculate RMS audio level from raw audio data
 * @param audioData Raw audio data as Uint8Array (16-bit PCM expected)
 * @returns RMS level (0.0 to 1.0)  
 */
export function calculateRMSLevel(audioData: Uint8Array): number {
  if (audioData.length === 0) return 0;
  
  let sum = 0;
  
  // Treat as 16-bit signed PCM data
  for (let i = 0; i < audioData.length; i += 2) {
    if (i + 1 < audioData.length) {
      // Convert little-endian 16-bit to signed integer
      const sample = (audioData[i + 1] << 8) | audioData[i];
      const normalized = sample < 0x8000 ? sample / 0x7FFF : (sample - 0x10000) / 0x8000;
      sum += normalized * normalized;
    }
  }
  
  return Math.sqrt(sum / (audioData.length / 2));
}

/**
 * Calculate RMS level from Float32Array audio data 
 * @param audioData Audio data as Float32Array [-1.0 to 1.0]
 * @returns RMS level (0.0 to 1.0)
 */
export function calculateRMSLevelFloat32(audioData: Float32Array): number {
  if (audioData.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  
  return Math.sqrt(sum / audioData.length);
}

/**
 * Check if audio has sufficient activity to warrant transcription
 * @param audioData Raw audio data
 * @param threshold RMS threshold below which audio is considered silent (default: 0.01)
 * @returns true if audio should be transcribed, false if likely silent
 */
export function hasAudioActivity(audioData: Uint8Array, threshold: number = 0.01): boolean {
  const rms = calculateRMSLevel(audioData);
  console.log(`🔊 Audio RMS level: ${rms.toFixed(4)}, threshold: ${threshold}`);
  
  if (rms < threshold) {
    console.log(`🔇 Audio level too low (${rms.toFixed(4)} < ${threshold}), skipping transcription`);
    return false;
  }
  
  return true;
}

/**
 * Check if Float32Array audio has sufficient activity
 * @param audioData Float32Array audio data  
 * @param threshold RMS threshold (default: 0.01)
 * @returns true if audio should be transcribed
 */
export function hasAudioActivityFloat32(audioData: Float32Array, threshold: number = 0.01): boolean {
  const rms = calculateRMSLevelFloat32(audioData);
  console.log(`🔊 Audio RMS level: ${rms.toFixed(4)}, threshold: ${threshold}`);
  
  if (rms < threshold) {
    console.log(`🔇 Audio level too low (${rms.toFixed(4)} < ${threshold}), skipping transcription`);
    return false;
  }
  
  return true;
}

/**
 * Enhanced audio quality check including RMS and dynamic range
 * @param audioData Raw audio data
 * @param rmsThreshold Minimum RMS level (default: 0.005)
 * @param dynamicRangeThreshold Minimum dynamic range (default: 0.02)
 * @returns true if audio quality is sufficient for transcription
 */
export function checkAudioQuality(
  audioData: Uint8Array, 
  rmsThreshold: number = 0.005,
  dynamicRangeThreshold: number = 0.02
): boolean {
  if (audioData.length === 0) return false;
  
  let sum = 0;
  let min = 1;
  let max = -1;
  
  // Process as 16-bit signed PCM
  for (let i = 0; i < audioData.length; i += 2) {
    if (i + 1 < audioData.length) {
      const sample = (audioData[i + 1] << 8) | audioData[i];
      const normalized = sample < 0x8000 ? sample / 0x7FFF : (sample - 0x10000) / 0x8000;
      
      sum += normalized * normalized;
      min = Math.min(min, normalized);
      max = Math.max(max, normalized);
    }
  }
  
  const rms = Math.sqrt(sum / (audioData.length / 2));
  const dynamicRange = max - min;
  
  console.log(`🔊 Audio quality - RMS: ${rms.toFixed(4)}, Dynamic Range: ${dynamicRange.toFixed(4)}`);
  
  const hasGoodRMS = rms >= rmsThreshold;
  const hasGoodDynamicRange = dynamicRange >= dynamicRangeThreshold;
  
  if (!hasGoodRMS) {
    console.log(`🔇 RMS too low (${rms.toFixed(4)} < ${rmsThreshold}), skipping transcription`);
  }
  
  if (!hasGoodDynamicRange) {
    console.log(`📊 Dynamic range too low (${dynamicRange.toFixed(4)} < ${dynamicRangeThreshold}), skipping transcription`);
  }
  
  return hasGoodRMS && hasGoodDynamicRange;
}

/**
 * Optimal chunk duration constants for Whisper transcription
 * Based on OpenAI recommendations and ChatGPT analysis
 */
export const OPTIMAL_CHUNK_DURATION = {
  MIN_SECONDS: 20,
  MAX_SECONDS: 30,
  PREFERRED_SECONDS: 25,
  
  // Convert to milliseconds
  MIN_MS: 20000,
  MAX_MS: 30000, 
  PREFERRED_MS: 25000
} as const;

/**
 * Get optimal chunk interval based on recording duration and context
 * @param elapsedMs Time elapsed since recording started
 * @param isEarlyMode Whether in early/fast response mode
 * @returns Optimal chunk interval in milliseconds
 */
export function getOptimalChunkInterval(elapsedMs: number, isEarlyMode: boolean = false): number {
  // Early mode for first 60 seconds - faster chunks to avoid missing speech
  if (isEarlyMode && elapsedMs < 60000) {
    if (elapsedMs < 4000) return 3000; // 3s for first chunk - capture immediately to avoid missing speech
    if (elapsedMs < 15000) return 8000; // 8s chunks for next 11 seconds - fast feedback
    return 15000; // 15s chunks for rest of early mode - balance speed vs duplication
  }
  
  // Normal mode - use optimal 25-second chunks
  return OPTIMAL_CHUNK_DURATION.PREFERRED_MS;
}