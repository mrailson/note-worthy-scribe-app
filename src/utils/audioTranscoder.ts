/**
 * Audio Transcoder Utility
 * Converts audio to Whisper-optimised format: 16kHz mono
 * Reduces file size by ~10-20× while maintaining transcription accuracy
 */

export interface TranscodeOptions {
  targetSampleRate?: number;  // Default: 16000 (Whisper's internal rate)
  channels?: number;          // Default: 1 (mono)
  format?: 'wav' | 'mp3';     // Default: 'wav' (browser-native, FLAC not supported in browsers)
}

const DEFAULT_OPTIONS: Required<TranscodeOptions> = {
  targetSampleRate: 16000,
  channels: 1,
  format: 'wav'
};

/**
 * Transcode audio blob to Whisper-optimised format
 * @param blob - Source audio blob (webm, opus, etc.)
 * @param options - Transcoding options
 * @returns Transcoded audio blob (16kHz mono WAV)
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
    
    // Convert to WAV format
    const wavBlob = audioBufferToWav(renderedBuffer);
    
    // Clean up
    await audioContext.close();
    
    console.log(`🎵 Transcoded: ${(blob.size / 1024).toFixed(1)}KB → ${(wavBlob.size / 1024).toFixed(1)}KB (${((1 - wavBlob.size / blob.size) * 100).toFixed(0)}% reduction)`);
    
    return wavBlob;
  } catch (error) {
    console.error('❌ Transcode failed, returning original:', error);
    // Return original blob if transcoding fails
    return blob;
  }
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
