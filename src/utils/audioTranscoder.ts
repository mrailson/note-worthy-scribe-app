/**
 * Audio Transcoder Utility
 * Converts audio to Whisper-optimised format: 16kHz mono
 * Supports WAV (lossless) and MP3 (compressed) output
 * Reduces file size significantly while maintaining transcription accuracy
 */

// @ts-ignore - lamejs doesn't have TypeScript declarations
import lamejs from 'lamejs';

export type Mp3Bitrate = 16 | 32 | 64 | 128;

export interface TranscodeOptions {
  targetSampleRate?: number;  // Default: 16000 (Whisper's internal rate)
  channels?: number;          // Default: 1 (mono)
  format?: 'wav' | 'mp3';     // Default: 'wav'
  mp3Bitrate?: Mp3Bitrate;    // Default: 64 (kbps) - only used for MP3
}

const DEFAULT_OPTIONS: Required<TranscodeOptions> = {
  targetSampleRate: 16000,
  channels: 1,
  format: 'wav',
  mp3Bitrate: 64
};

/**
 * Transcode audio blob to Whisper-optimised format
 * @param blob - Source audio blob (webm, opus, etc.)
 * @param options - Transcoding options
 * @returns Transcoded audio blob (16kHz mono WAV or MP3)
 */
export async function transcodeToWhisperFormat(
  blob: Blob,
  options: TranscodeOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    // Create audio context with target sample rate
    const audioContext = new AudioContext({ sampleRate: opts.targetSampleRate });
    
    // Decode the source audio
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create offline context for resampling
    const offlineContext = new OfflineAudioContext(
      opts.channels,
      Math.ceil(audioBuffer.duration * opts.targetSampleRate),
      opts.targetSampleRate
    );
    
    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // If we need to downmix to mono
    if (opts.channels === 1 && audioBuffer.numberOfChannels > 1) {
      // Create a channel merger/splitter to mix down to mono
      const splitter = offlineContext.createChannelSplitter(audioBuffer.numberOfChannels);
      const merger = offlineContext.createChannelMerger(1);
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = 1 / audioBuffer.numberOfChannels;
      
      source.connect(splitter);
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        splitter.connect(gainNode, i);
      }
      gainNode.connect(merger, 0, 0);
      merger.connect(offlineContext.destination);
    } else {
      source.connect(offlineContext.destination);
    }
    
    source.start(0);
    
    // Render the audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to selected format
    let outputBlob: Blob;
    if (opts.format === 'mp3') {
      outputBlob = audioBufferToMp3(renderedBuffer, opts.mp3Bitrate);
    } else {
      outputBlob = audioBufferToWav(renderedBuffer);
    }
    
    // Clean up
    await audioContext.close();
    
    const formatLabel = opts.format === 'mp3' ? `MP3 ${opts.mp3Bitrate}kbps` : 'WAV';
    console.log(`🎵 Transcoded to ${formatLabel}: ${(blob.size / 1024).toFixed(1)}KB → ${(outputBlob.size / 1024).toFixed(1)}KB (${((1 - outputBlob.size / blob.size) * 100).toFixed(0)}% reduction)`);
    
    return outputBlob;
  } catch (error) {
    console.error('❌ Transcode failed, returning original:', error);
    // Return original blob if transcoding fails
    return blob;
  }
}

/**
 * Convert AudioBuffer to MP3 Blob using lamejs
 * @param buffer - AudioBuffer to convert
 * @param bitrate - Target bitrate in kbps (16, 32, 64, or 128)
 */
function audioBufferToMp3(buffer: AudioBuffer, bitrate: Mp3Bitrate = 64): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  
  // Create MP3 encoder
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
  
  // Get channel data
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  const samples = buffer.length;
  const blockSize = 1152; // MP3 frame size
  const mp3Data: ArrayBuffer[] = [];
  
  // Process samples in blocks
  for (let i = 0; i < samples; i += blockSize) {
    const blockLength = Math.min(blockSize, samples - i);
    
    if (numChannels === 1) {
      // Mono
      const monoSamples = new Int16Array(blockLength);
      for (let j = 0; j < blockLength; j++) {
        const sample = Math.max(-1, Math.min(1, channelData[0][i + j]));
        monoSamples[j] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      const mp3buf = mp3encoder.encodeBuffer(monoSamples);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf).buffer);
      }
    } else {
      // Stereo
      const leftSamples = new Int16Array(blockLength);
      const rightSamples = new Int16Array(blockLength);
      for (let j = 0; j < blockLength; j++) {
        const leftSample = Math.max(-1, Math.min(1, channelData[0][i + j]));
        const rightSample = Math.max(-1, Math.min(1, channelData[1][i + j]));
        leftSamples[j] = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
        rightSamples[j] = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;
      }
      const mp3buf = mp3encoder.encodeBuffer(leftSamples, rightSamples);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf).buffer);
      }
    }
  }
  
  // Flush remaining data
  const mp3End = mp3encoder.flush();
  if (mp3End.length > 0) {
    mp3Data.push(new Uint8Array(mp3End).buffer);
  }
  
  // Combine all MP3 data into a single blob
  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * Convert AudioBuffer to WAV Blob
 * Creates a 16-bit PCM WAV file
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
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
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Interleave channels and write samples
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // Convert float [-1, 1] to 16-bit integer
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Check if transcoding is beneficial for the given blob
 * Skip transcoding for already small files or WAV files
 */
export function shouldTranscode(blob: Blob): boolean {
  // Don't transcode if already small (< 50KB)
  if (blob.size < 50 * 1024) return false;
  
  // Don't transcode if already WAV at correct sample rate
  if (blob.type === 'audio/wav') return false;
  
  return true;
}

/**
 * Get format label for display
 */
export function getFormatLabel(format: 'wav' | 'mp3', mp3Bitrate?: Mp3Bitrate): string {
  if (format === 'mp3') {
    return `MP3 ${mp3Bitrate || 64}kbps`;
  }
  return 'WAV (16-bit PCM)';
}

/**
 * Estimate file size for a given duration and format
 * @param durationSeconds - Duration in seconds
 * @param format - Output format
 * @param mp3Bitrate - MP3 bitrate (only used for MP3)
 * @returns Estimated file size in bytes
 */
export function estimateFileSize(
  durationSeconds: number,
  format: 'wav' | 'mp3',
  mp3Bitrate?: Mp3Bitrate
): number {
  if (format === 'wav') {
    // 16kHz, 16-bit, mono = 32KB per second
    return durationSeconds * 32 * 1024;
  } else {
    // MP3: bitrate in kbps / 8 = KB per second
    const bitrate = mp3Bitrate || 64;
    return durationSeconds * (bitrate / 8) * 1024;
  }
}
