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
 * Decode an audio file and return its duration in seconds.
 */
export async function getAudioDuration(file: File): Promise<number> {
  const ctx = getAudioContext();
  const buffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(buffer);
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
  const ctx = getAudioContext();
  const buffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(buffer);

  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.round(startSec * sampleRate);
  const endSample = Math.min(Math.round(endSec * sampleRate), audioBuffer.length);
  const frameCount = endSample - startSample;
  const numChannels = audioBuffer.numberOfChannels;

  // Extract channel data for the trimmed region
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const full = audioBuffer.getChannelData(ch);
    channels.push(full.slice(startSample, endSample));
  }

  // Encode to 16-bit PCM WAV
  const wavBlob = encodeWav(channels, sampleRate, numChannels, frameCount);

  // Derive a new filename
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = '.wav';
  const newName = `${baseName}_trimmed${ext}`;

  return new File([wavBlob], newName, { type: 'audio/wav' });
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
