/**
 * Audio trimming utilities using the Web Audio API.
 * Decodes audio files, slices AudioBuffers, and re-encodes to WAV.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

/**
 * Parse WAV header to extract duration without decoding the full file.
 * Returns duration in seconds, or null if not a valid WAV.
 */
function getWavDurationFromHeader(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 44) return null;
  
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== 'RIFF') return null;

  const view = new DataView(buffer);

  // Find the "data" sub-chunk
  let offset = 12;
  let dataSize = 0;

  while (offset < bytes.length - 8) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
    if (offset % 2 !== 0) offset++; // pad byte
  }

  if (dataSize === 0) return null;

  const sampleRate = view.getUint32(24, true);
  const numChannels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);
  const blockAlign = numChannels * (bitsPerSample / 8);

  if (sampleRate === 0 || blockAlign === 0) return null;

  const totalSamples = dataSize / blockAlign;
  return totalSamples / sampleRate;
}

/**
 * Get the duration of an audio file in seconds.
 * Uses WAV header parsing first (reliable), falls back to Web Audio API.
 */
export async function getAudioDuration(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();

  // Try WAV header parsing first — works for all recorder WAV files
  const wavDuration = getWavDurationFromHeader(buffer);
  if (wavDuration !== null && wavDuration > 0) {
    return wavDuration;
  }

  // Fallback: decode with Web Audio API (works for MP3, M4A, OGG, etc.)
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(buffer.slice(0)); // slice to avoid detached buffer
  return audioBuffer.duration;
}

/**
 * Decode an audio file, slice to [startSec, endSec], and re-encode as a WAV File.
 */
export async function trimAudioFile(
  file: File,
  startSec: number,
  endSec: number
): Promise<File> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  // For WAV files, slice raw PCM directly (avoids decodeAudioData failures)
  if (riff === 'RIFF') {
    return trimWavDirect(buffer, file.name, startSec, endSec);
  }

  // For non-WAV (MP3, M4A, etc.), decode via Web Audio API
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));

  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.round(startSec * sampleRate);
  const endSample = Math.min(Math.round(endSec * sampleRate), audioBuffer.length);
  const frameCount = endSample - startSample;
  const numChannels = audioBuffer.numberOfChannels;

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch).slice(startSample, endSample));
  }

  const wavBlob = encodeWav(channels, sampleRate, numChannels, frameCount);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([wavBlob], `${baseName}_trimmed.wav`, { type: 'audio/wav' });
}

/**
 * Trim a WAV file by slicing raw PCM bytes directly — no decoding needed.
 */
function trimWavDirect(buffer: ArrayBuffer, originalName: string, startSec: number, endSec: number): File {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Parse header to find data chunk
  let offset = 12;
  let dataOffset = 0;
  let dataSize = 0;
  while (offset < bytes.length - 8) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
    if (offset % 2 !== 0) offset++;
  }

  const sampleRate = view.getUint32(24, true);
  const numChannels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const startByte = dataOffset + Math.round(startSec * sampleRate) * blockAlign;
  const endByte = dataOffset + Math.min(Math.round(endSec * sampleRate) * blockAlign, dataSize);
  const trimmedData = bytes.slice(startByte, endByte);
  const trimmedDataSize = trimmedData.length;

  // Build new WAV with header
  const header = new Uint8Array(44);
  const hView = new DataView(header.buffer);
  writeString(header, 0, 'RIFF');
  hView.setUint32(4, 36 + trimmedDataSize, true);
  writeString(header, 8, 'WAVE');
  writeString(header, 12, 'fmt ');
  hView.setUint32(16, 16, true);
  hView.setUint16(20, 1, true);
  hView.setUint16(22, numChannels, true);
  hView.setUint32(24, sampleRate, true);
  hView.setUint32(28, sampleRate * blockAlign, true);
  hView.setUint16(32, blockAlign, true);
  hView.setUint16(34, bitsPerSample, true);
  writeString(header, 36, 'data');
  hView.setUint32(40, trimmedDataSize, true);

  const result = new Uint8Array(44 + trimmedDataSize);
  result.set(header);
  result.set(trimmedData, 44);

  const baseName = originalName.replace(/\.[^.]+$/, '');
  return new File(
    [new Blob([result], { type: 'audio/wav' })],
    `${baseName}_trimmed.wav`,
    { type: 'audio/wav' }
  );
}

/**
 * Encode Float32 channel data into a 16-bit PCM WAV blob.
 */
function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  numChannels: number,
  frameCount: number
): Blob {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const bufferSize = 44 + dataSize;

  const buf = new ArrayBuffer(bufferSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // RIFF header
  writeString(bytes, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(bytes, 8, 'WAVE');

  // fmt sub-chunk
  writeString(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(bytes, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and convert Float32 → Int16
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

function writeString(bytes: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    bytes[offset + i] = str.charCodeAt(i);
  }
}

/**
 * Format seconds as MM:SS.
 */
export function formatTrimDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
