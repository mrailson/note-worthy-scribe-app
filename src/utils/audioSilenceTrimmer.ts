/**
 * Audio Silence Trimmer Utility
 * Removes leading and trailing silence from audio chunks
 * Improves last-word confidence and sentence boundary detection
 */

export interface TrimOptions {
  thresholdMs?: number;       // Silence duration to trim (default: 500ms)
  silenceLevel?: number;      // Silence threshold in dB (default: -40)
  minDurationMs?: number;     // Minimum audio duration to keep (default: 100ms)
}

const DEFAULT_OPTIONS: Required<TrimOptions> = {
  thresholdMs: 500,
  silenceLevel: -40,
  minDurationMs: 100
};

/**
 * Trim leading and trailing silence from audio blob
 * @param blob - Source audio blob
 * @param options - Trimming options
 * @returns Trimmed audio blob
 */
export async function trimSilence(
  blob: Blob,
  options: TrimOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get mono channel data for analysis
    const channelData = audioBuffer.numberOfChannels > 1 
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0);
    
    const sampleRate = audioBuffer.sampleRate;
    const thresholdSamples = Math.floor((opts.thresholdMs / 1000) * sampleRate);
    const minSamples = Math.floor((opts.minDurationMs / 1000) * sampleRate);
    const silenceThreshold = dbToLinear(opts.silenceLevel);
    
    // Find first non-silent sample
    let startSample = findFirstNonSilent(channelData, silenceThreshold, thresholdSamples);
    
    // Find last non-silent sample
    let endSample = findLastNonSilent(channelData, silenceThreshold, thresholdSamples);
    
    // Ensure minimum duration
    if (endSample - startSample < minSamples) {
      console.log('🔇 Audio too short after trim, returning original');
      await audioContext.close();
      return blob;
    }
    
    // Check if trimming is needed
    const totalSamples = channelData.length;
    const trimmedStart = startSample;
    const trimmedEnd = totalSamples - endSample;
    
    if (trimmedStart < thresholdSamples && trimmedEnd < thresholdSamples) {
      console.log('🔇 No significant silence to trim');
      await audioContext.close();
      return blob;
    }
    
    // Create trimmed buffer
    const trimmedLength = endSample - startSample;
    const trimmedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      trimmedLength,
      sampleRate
    );
    
    // Copy trimmed audio to new buffer
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const destData = trimmedBuffer.getChannelData(channel);
      for (let i = 0; i < trimmedLength; i++) {
        destData[i] = sourceData[startSample + i];
      }
    }
    
    // Convert back to blob
    const trimmedBlob = await audioBufferToBlob(trimmedBuffer, blob.type || 'audio/webm');
    
    const trimmedMs = ((trimmedStart + trimmedEnd) / sampleRate * 1000).toFixed(0);
    console.log(`✂️ Trimmed ${trimmedMs}ms silence (${(trimmedStart / sampleRate * 1000).toFixed(0)}ms lead, ${(trimmedEnd / sampleRate * 1000).toFixed(0)}ms trail)`);
    
    await audioContext.close();
    return trimmedBlob;
    
  } catch (error) {
    console.error('❌ Silence trim failed, returning original:', error);
    return blob;
  }
}

/**
 * Convert dB to linear amplitude
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Mix stereo to mono
 */
function mixToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  const numChannels = buffer.numberOfChannels;
  
  for (let i = 0; i < buffer.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < numChannels; channel++) {
      sum += buffer.getChannelData(channel)[i];
    }
    mono[i] = sum / numChannels;
  }
  
  return mono;
}

/**
 * Find first sample that exceeds silence threshold
 * Returns sample index after silence threshold duration
 */
function findFirstNonSilent(
  data: Float32Array,
  threshold: number,
  minSilentSamples: number
): number {
  let silentCount = 0;
  let firstLoudSample = 0;
  
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) {
      if (silentCount >= minSilentSamples) {
        // We've found content after significant silence
        return i;
      }
      firstLoudSample = i;
      silentCount = 0;
    } else {
      if (firstLoudSample === 0) {
        silentCount++;
      }
    }
  }
  
  return firstLoudSample;
}

/**
 * Find last sample that exceeds silence threshold
 * Returns sample index before trailing silence
 */
function findLastNonSilent(
  data: Float32Array,
  threshold: number,
  minSilentSamples: number
): number {
  let silentCount = 0;
  let lastLoudSample = data.length;
  
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i]) > threshold) {
      if (silentCount >= minSilentSamples) {
        // We've found content before significant silence
        return i;
      }
      lastLoudSample = i;
      silentCount = 0;
    } else {
      if (lastLoudSample === data.length) {
        silentCount++;
      }
    }
  }
  
  return lastLoudSample;
}

/**
 * Convert AudioBuffer back to Blob
 * Uses WAV format for lossless conversion
 */
async function audioBufferToBlob(buffer: AudioBuffer, targetType: string): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  // Return as WAV (browsers handle this better than webm re-encoding)
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Quick check if audio likely has significant silence to trim
 * Useful for deciding whether to run the full trim process
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
