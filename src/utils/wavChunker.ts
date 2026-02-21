/**
 * Client-side WAV file chunker.
 * Splits large WAV files into sub-25MB chunks with proper headers,
 * so each chunk can be sent individually to Whisper via the speech-to-text edge function.
 */

interface WavInfo {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

function parseWavHeader(buf: ArrayBuffer): WavInfo {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Find "data" sub-chunk
  let offset = 12; // skip RIFF header
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
    if (offset % 2 !== 0) offset++; // pad byte
  }

  if (dataOffset === 0) {
    throw new Error('Invalid WAV file: no data chunk found');
  }

  return {
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataOffset,
    dataSize,
  };
}

function buildWavHeader(dataSize: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  // RIFF
  header.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  header.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  // fmt
  header.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data
  header.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);
  return header;
}

export interface WavChunk {
  /** The chunk as a complete WAV file (header + PCM data) */
  blob: Blob;
  /** 0-indexed chunk number */
  index: number;
  /** Total number of chunks */
  total: number;
}

/**
 * Split a WAV file into chunks that are each under targetSizeMB.
 * Each chunk is a valid WAV file with its own header.
 * Non-WAV files or small WAV files are returned as a single chunk.
 */
export async function chunkWavFile(file: File, targetSizeMB = 20): Promise<WavChunk[]> {
  const TARGET_BYTES = targetSizeMB * 1024 * 1024;

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check if it's actually a WAV file
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== 'RIFF') {
    // Not a WAV — return as single chunk
    return [{ blob: new Blob([buffer], { type: file.type || 'audio/wav' }), index: 0, total: 1 }];
  }

  const wav = parseWavHeader(buffer);
  const blockAlign = wav.numChannels * (wav.bitsPerSample / 8);
  const totalDataSize = Math.min(wav.dataSize, bytes.length - wav.dataOffset);

  // If file is small enough, return as single chunk
  if (totalDataSize + 44 <= TARGET_BYTES) {
    return [{ blob: new Blob([buffer], { type: 'audio/wav' }), index: 0, total: 1 }];
  }

  // Calculate chunk data size (aligned to block boundary)
  const chunkDataSize = Math.floor(TARGET_BYTES / blockAlign) * blockAlign;
  const numChunks = Math.ceil(totalDataSize / chunkDataSize);
  const chunks: WavChunk[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = wav.dataOffset + i * chunkDataSize;
    const end = Math.min(start + chunkDataSize, wav.dataOffset + totalDataSize);
    const pcmSlice = bytes.slice(start, end);
    const header = buildWavHeader(pcmSlice.length, wav.sampleRate, wav.numChannels, wav.bitsPerSample);

    const chunkBuffer = new Uint8Array(header.length + pcmSlice.length);
    chunkBuffer.set(header);
    chunkBuffer.set(pcmSlice, header.length);

    chunks.push({
      blob: new Blob([chunkBuffer], { type: 'audio/wav' }),
      index: i,
      total: numChunks,
    });
  }

  return chunks;
}

/**
 * Convert a Blob to base64 string (without data URL prefix).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
