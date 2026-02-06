/**
 * Audio Silence Trimmer Utility
 * 
 * UPDATED: Silence trimming no longer re-encodes audio to WAV.
 * The trimSilence() function now returns the original blob unchanged,
 * as server-side preprocessing (via transcode-audio edge function) handles
 * all audio normalisation including silence at chunk boundaries.
 * 
 * Detection functions (hasSilenceToTrim) are retained for optional
 * client-side filtering of entirely-silent chunks before upload.
 */

export interface TrimOptions {
  thresholdMs?: number;       // Silence duration to detect (default: 500ms)
  silenceLevel?: number;      // Silence threshold in dB (default: -40)
  minDurationMs?: number;     // Minimum audio duration to keep (default: 100ms)
}

const DEFAULT_OPTIONS: Required<TrimOptions> = {
  thresholdMs: 500,
  silenceLevel: -40,
  minDurationMs: 100
};

/**
 * @deprecated Silence trimming is now handled server-side.
 * Returns the original blob unchanged to avoid client-side WAV re-encoding.
 */
export async function trimSilence(
  blob: Blob,
  _options: TrimOptions = {}
): Promise<Blob> {
  console.log(`✂️ trimSilence: pass-through (server-side processing active). Size: ${(blob.size / 1024).toFixed(1)}KB`);
  return blob;
}

/**
 * Convert dB to linear amplitude
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Quick check if audio likely has significant silence to trim.
 * Useful for deciding whether to skip uploading entirely-silent chunks.
 */
export async function hasSilenceToTrim(
  blob: Blob,
  options: TrimOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const thresholdSamples = Math.floor((opts.thresholdMs / 1000) * sampleRate);
    const silenceThreshold = dbToLinear(opts.silenceLevel);
    
    // Check first thresholdMs
    let leadingSilent = 0;
    for (let i = 0; i < Math.min(thresholdSamples * 2, channelData.length); i++) {
      if (Math.abs(channelData[i]) < silenceThreshold) {
        leadingSilent++;
      }
    }
    
    // Check last thresholdMs
    let trailingSilent = 0;
    for (let i = channelData.length - 1; i > Math.max(channelData.length - thresholdSamples * 2, 0); i--) {
      if (Math.abs(channelData[i]) < silenceThreshold) {
        trailingSilent++;
      }
    }
    
    await audioContext.close();
    
    return leadingSilent > thresholdSamples || trailingSilent > thresholdSamples;
  } catch {
    return false;
  }
}

/**
 * Check if an audio blob is predominantly silence (>90% of samples below threshold).
 * Useful for skipping upload of entirely-silent chunks to save bandwidth.
 */
export async function isChunkMostlySilent(
  blob: Blob,
  silenceLevelDb: number = -40,
  silenceRatio: number = 0.90
): Promise<boolean> {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const threshold = dbToLinear(silenceLevelDb);
    
    let silentSamples = 0;
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) < threshold) {
        silentSamples++;
      }
    }
    
    await audioContext.close();
    
    const ratio = silentSamples / channelData.length;
    return ratio >= silenceRatio;
  } catch {
    return false;
  }
}
