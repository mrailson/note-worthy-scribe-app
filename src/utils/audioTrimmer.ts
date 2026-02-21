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

/**
 * Extract the sample rate from a WAV file header.
 * Returns the sample rate or null if not a valid WAV.
 */
export function getWavSampleRate(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 28) return null;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== 'RIFF') return null;
  const view = new DataView(buffer);
  return view.getUint32(24, true);
}

/**
 * Manually decode a WAV file's raw data into an AudioBuffer.
 * Supports PCM (format 1), A-law (format 6), and mu-law (format 7).
 * This works when decodeAudioData() fails (e.g. recorder WAV formats).
 */
export function decodeWavToAudioBuffer(ctx: AudioContext, buffer: ArrayBuffer): AudioBuffer | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 44) return null;
  
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== 'RIFF') return null;

  const view = new DataView(buffer);
  const formatCode = view.getUint16(20, true); // 1=PCM, 6=A-law, 7=mu-law, 17=IMA ADPCM
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const blockAlignHeader = view.getUint16(32, true);
  const bitsPerSample = view.getUint16(34, true);

  console.log(`[WAV decode] format=${formatCode}, ${numChannels}ch, ${sampleRate}Hz, ${bitsPerSample}bit, blockAlign=${blockAlignHeader}`);

  // Find data chunk
  let offset = 12;
  let dataOffset = 0;
  let dataSize = 0;
  while (offset < bytes.length - 8) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, bytes.length - (offset + 8));
      break;
    }
    offset += 8 + chunkSize;
    if (offset % 2 !== 0) offset++;
  }

  if (dataOffset === 0 || sampleRate === 0) return null;

  // IMA ADPCM (format 17) — needs special block-based decoding
  if (formatCode === 17) {
    return decodeImaAdpcm(ctx, bytes, view, dataOffset, dataSize, blockAlignHeader, numChannels, sampleRate);
  }

  const blockAlign = numChannels * (bitsPerSample / 8);
  if (blockAlign === 0) return null;

  const frameCount = Math.floor(dataSize / blockAlign);
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      const sampleOffset = dataOffset + i * blockAlign + ch * (bitsPerSample / 8);
      let sample: number;

      if (formatCode === 6) {
        sample = alawToLinear(bytes[sampleOffset]);
      } else if (formatCode === 7) {
        sample = mulawToLinear(bytes[sampleOffset]);
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(sampleOffset, true) / 32768;
      } else if (bitsPerSample === 24) {
        const b0 = bytes[sampleOffset];
        const b1 = bytes[sampleOffset + 1];
        const b2 = bytes[sampleOffset + 2];
        let val = (b2 << 16) | (b1 << 8) | b0;
        if (val >= 0x800000) val -= 0x1000000;
        sample = val / 8388608;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(sampleOffset, true) / 2147483648;
      } else if (bitsPerSample === 8) {
        sample = (bytes[sampleOffset] - 128) / 128;
      } else {
        sample = 0;
      }
      channelData[i] = sample;
    }
  }

  return audioBuffer;
}

// --- A-law and mu-law decoders (ITU-T G.711) ---

function alawToLinear(alaw: number): number {
  let a = alaw ^ 0x55;
  const sign = (a & 0x80) ? -1 : 1;
  a = a & 0x7F;
  const segment = (a >> 4) & 0x07;
  const mantissa = a & 0x0F;
  let magnitude: number;
  if (segment === 0) {
    magnitude = (mantissa * 2 + 1) * 2;
  } else {
    magnitude = ((mantissa * 2 + 33) << segment) >> 1;
  }
  // Normalise to -1..1 range (max A-law value is ~32256)
  return sign * magnitude / 32768;
}

function mulawToLinear(mulaw: number): number {
  const mu = ~mulaw & 0xFF;
  const sign = (mu & 0x80) ? -1 : 1;
  const segment = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0F;
  const magnitude = ((mantissa * 2 + 33) << segment) - 33;
  return sign * magnitude / 32768;
}

// --- IMA ADPCM decoder (format 17) ---

const IMA_STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
  34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
  157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
  724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024,
  3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
  15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
];

const IMA_INDEX_TABLE = [
  -1, -1, -1, -1, 2, 4, 6, 8,
  -1, -1, -1, -1, 2, 4, 6, 8
];

function decodeImaAdpcm(
  ctx: AudioContext,
  bytes: Uint8Array,
  view: DataView,
  dataOffset: number,
  dataSize: number,
  blockAlign: number,
  numChannels: number,
  sampleRate: number
): AudioBuffer | null {
  if (blockAlign === 0) return null;

  // Samples per block: preamble has 1 sample per channel, then (blockAlign - 4*channels) bytes of nibbles
  const samplesPerBlock = (blockAlign - 4 * numChannels) * 2 / numChannels + 1;
  const numBlocks = Math.floor(dataSize / blockAlign);
  const totalSamples = numBlocks * samplesPerBlock;

  console.log(`[IMA ADPCM] ${numBlocks} blocks, ${samplesPerBlock} samples/block, ${totalSamples} total samples`);

  const audioBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  let sampleIdx = 0;

  for (let block = 0; block < numBlocks; block++) {
    const blockStart = dataOffset + block * blockAlign;
    const predictors: number[] = [];
    const stepIndices: number[] = [];

    // Read preamble for each channel (4 bytes each)
    for (let ch = 0; ch < numChannels; ch++) {
      const preambleOffset = blockStart + ch * 4;
      let predictor = view.getInt16(preambleOffset, true);
      let stepIndex = bytes[preambleOffset + 2];
      // Clamp step index
      if (stepIndex > 88) stepIndex = 88;
      if (stepIndex < 0) stepIndex = 0;
      predictors.push(predictor);
      stepIndices.push(stepIndex);
      channelData[ch][sampleIdx] = predictor / 32768;
    }
    sampleIdx++;

    // Decode nibbles
    const dataStart = blockStart + 4 * numChannels;
    const nibbleBytes = blockAlign - 4 * numChannels;

    if (numChannels === 1) {
      // Mono: sequential nibbles
      for (let i = 0; i < nibbleBytes; i++) {
        const b = bytes[dataStart + i];
        for (let nibbleIdx = 0; nibbleIdx < 2; nibbleIdx++) {
          const nibble = nibbleIdx === 0 ? (b & 0x0F) : ((b >> 4) & 0x0F);
          const step = IMA_STEP_TABLE[stepIndices[0]];
          let diff = ((nibble & 7) * 2 + 1) * step / 8;
          if (nibble & 8) diff = -diff;
          predictors[0] = Math.max(-32768, Math.min(32767, predictors[0] + diff));
          stepIndices[0] = Math.max(0, Math.min(88, stepIndices[0] + IMA_INDEX_TABLE[nibble]));
          if (sampleIdx < totalSamples) {
            channelData[0][sampleIdx] = predictors[0] / 32768;
            sampleIdx++;
          }
        }
      }
    } else {
      // Stereo/multi-channel: interleaved in 4-byte packets per channel
      let bytePos = 0;
      const samplesRemaining = samplesPerBlock - 1;
      let decoded = 0;
      while (decoded < samplesRemaining && (dataStart + bytePos) < bytes.length) {
        for (let ch = 0; ch < numChannels; ch++) {
          // Each channel gets 4 bytes = 8 nibbles
          for (let j = 0; j < 4 && decoded < samplesRemaining; j++) {
            const b = bytes[dataStart + bytePos];
            bytePos++;
            for (let nibbleIdx = 0; nibbleIdx < 2 && decoded < samplesRemaining; nibbleIdx++) {
              const nibble = nibbleIdx === 0 ? (b & 0x0F) : ((b >> 4) & 0x0F);
              const step = IMA_STEP_TABLE[stepIndices[ch]];
              let diff = ((nibble & 7) * 2 + 1) * step / 8;
              if (nibble & 8) diff = -diff;
              predictors[ch] = Math.max(-32768, Math.min(32767, predictors[ch] + diff));
              stepIndices[ch] = Math.max(0, Math.min(88, stepIndices[ch] + IMA_INDEX_TABLE[nibble]));
              channelData[ch][sampleIdx + decoded] = predictors[ch] / 32768;
              decoded++;
            }
          }
        }
      }
      sampleIdx += decoded;
    }
  }

  return audioBuffer;
}
