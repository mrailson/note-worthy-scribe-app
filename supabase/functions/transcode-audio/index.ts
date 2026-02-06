import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * transcode-audio Edge Function
 *
 * Server-side audio preprocessing for batch transcription.
 * Strips ALL non-audio streams (subtitles, data, video) from WebM/MKV
 * containers so Whisper never receives subtitle or data metadata.
 *
 * For non-container formats (WAV, FLAC, MP3, OGG) the audio is passed
 * through unchanged as they cannot carry subtitle tracks.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_INPUT_BYTES = 24 * 1024 * 1024; // 24 MB
const WARN_BYTES = 20 * 1024 * 1024;

// ── EBML element IDs (big-endian hex) ────────────────────────────────
// These are the raw multi-byte IDs used in WebM/MKV containers.
const EBML_HEADER_ID    = 0x1A45DFA3;
const SEGMENT_ID        = 0x18538067;
const SEEK_HEAD_ID      = 0x114D9B74;
const SEGMENT_INFO_ID   = 0x1549A966;
const TRACKS_ID         = 0x1654AE6B;
const TRACK_ENTRY_ID    = 0xAE;
const TRACK_NUMBER_ID   = 0xD7;
const TRACK_TYPE_ID     = 0x83;
const CLUSTER_ID        = 0x1F43B675;
const SIMPLE_BLOCK_ID   = 0xA3;
const BLOCK_GROUP_ID    = 0xA0;
const BLOCK_ID          = 0xA1;
const TIMECODE_ID       = 0xE7;
const CUES_ID           = 0x1C53BB6B;
const TAGS_ID           = 0x1254C367;
const CHAPTERS_ID       = 0x1043A770;
const ATTACHMENTS_ID    = 0x1941A469;

const TRACK_TYPE_VIDEO    = 1;
const TRACK_TYPE_AUDIO    = 2;
const TRACK_TYPE_SUBTITLE = 17;

// ── Binary helpers ───────────────────────────────────────────────────

/** Read an EBML variable-size integer (VINT) for element IDs. Returns [id, bytesConsumed]. */
function readVint(buf: Uint8Array, pos: number): [number, number] {
  if (pos >= buf.length) return [0, 0];
  const first = buf[pos];
  if (first === 0) return [0, 0];

  // Count leading zero bits to determine VINT width
  let width = 1;
  let mask = 0x80;
  while (width <= 8 && (first & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (width > 8 || pos + width > buf.length) return [0, 0];

  let value = first; // keep VINT marker bit for IDs
  for (let i = 1; i < width; i++) {
    value = (value << 8) | buf[pos + i];
  }
  return [value, width];
}

/** Read an EBML data-size VINT (marker bit stripped). Returns [size, bytesConsumed]. -1 = unknown size. */
function readDataSize(buf: Uint8Array, pos: number): [number, number] {
  if (pos >= buf.length) return [0, 0];
  const first = buf[pos];
  if (first === 0) return [0, 0];

  let width = 1;
  let mask = 0x80;
  while (width <= 8 && (first & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (width > 8 || pos + width > buf.length) return [0, 0];

  // Strip the VINT marker bit from the first byte
  let value = first & (mask - 1);
  let allOnes = (mask - 1) === value; // check for "unknown size" sentinel
  for (let i = 1; i < width; i++) {
    value = (value << 8) | buf[pos + i];
    if (buf[pos + i] !== 0xFF) allOnes = false;
  }

  // "All ones" = unknown/indeterminate size
  if (allOnes) return [-1, width];
  return [value, width];
}

/** Encode a VINT data-size value into bytes. */
function encodeDataSize(size: number): Uint8Array {
  if (size < 0x7F) return new Uint8Array([0x80 | size]);
  if (size < 0x3FFF) return new Uint8Array([0x40 | (size >> 8), size & 0xFF]);
  if (size < 0x1FFFFF) return new Uint8Array([0x20 | (size >> 16), (size >> 8) & 0xFF, size & 0xFF]);
  if (size < 0x0FFFFFFF) return new Uint8Array([0x10 | (size >> 24), (size >> 16) & 0xFF, (size >> 8) & 0xFF, size & 0xFF]);
  // For larger sizes, use 8-byte encoding
  const out = new Uint8Array(8);
  out[0] = 0x01;
  for (let i = 7; i >= 1; i--) {
    out[i] = size & 0xFF;
    size = Math.floor(size / 256);
  }
  return out;
}

/** Encode an EBML element ID into its raw bytes. */
function encodeId(id: number): Uint8Array {
  if (id <= 0xFF) return new Uint8Array([id]);
  if (id <= 0xFFFF) return new Uint8Array([id >> 8, id & 0xFF]);
  if (id <= 0xFFFFFF) return new Uint8Array([(id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF]);
  return new Uint8Array([(id >> 24) & 0xFF, (id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF]);
}

/** Read an unsigned integer of N bytes from a buffer. */
function readUint(buf: Uint8Array, pos: number, len: number): number {
  let val = 0;
  for (let i = 0; i < len; i++) {
    val = (val << 8) | buf[pos + i];
  }
  return val;
}

/** Concatenate multiple Uint8Arrays. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ── EBML container-level stream stripping ────────────────────────────

interface TrackInfo {
  trackNumber: number;
  trackType: number;
  rawBytes: Uint8Array; // original TrackEntry element bytes
}

/**
 * Parse all TrackEntry elements from a Tracks master element payload.
 */
function parseTrackEntries(payload: Uint8Array): TrackInfo[] {
  const tracks: TrackInfo[] = [];
  let pos = 0;

  while (pos < payload.length) {
    const [id, idLen] = readVint(payload, pos);
    if (idLen === 0) break;
    const [size, sizeLen] = readDataSize(payload, pos + idLen);
    if (sizeLen === 0 || size < 0) break;

    const elementStart = pos;
    const elementEnd = pos + idLen + sizeLen + size;

    if (id === TRACK_ENTRY_ID) {
      // Parse children for TrackNumber and TrackType
      let trackNumber = 0;
      let trackType = 0;
      let childPos = pos + idLen + sizeLen;
      const childEnd = elementEnd;

      while (childPos < childEnd) {
        const [cId, cIdLen] = readVint(payload, childPos);
        if (cIdLen === 0) break;
        const [cSize, cSizeLen] = readDataSize(payload, childPos + cIdLen);
        if (cSizeLen === 0 || cSize < 0) break;

        const dataStart = childPos + cIdLen + cSizeLen;

        if (cId === TRACK_NUMBER_ID && cSize > 0 && cSize <= 4) {
          trackNumber = readUint(payload, dataStart, cSize);
        } else if (cId === TRACK_TYPE_ID && cSize > 0 && cSize <= 4) {
          trackType = readUint(payload, dataStart, cSize);
        }

        childPos = dataStart + cSize;
      }

      tracks.push({
        trackNumber,
        trackType,
        rawBytes: payload.slice(elementStart, elementEnd),
      });
    }

    pos = elementEnd;
  }

  return tracks;
}

/**
 * Extract the track number from a SimpleBlock or Block element's payload.
 * The first byte(s) of the payload encode the track number as a VINT.
 */
function blockTrackNumber(payload: Uint8Array): number {
  const [val, width] = readVint(payload, 0);
  if (width === 0) return 0;
  // Strip the VINT marker bit to get the track number
  let mask = 0x80;
  let w = 1;
  while (w <= 8 && (payload[0] & mask) === 0) {
    w++;
    mask >>= 1;
  }
  return val & ((1 << (7 * w)) - 1);
}

/**
 * Strip non-audio streams from a WebM/MKV container.
 *
 * Strategy:
 *  1. Copy the EBML Header verbatim.
 *  2. Inside Segment, rebuild Tracks with only audio TrackEntry elements.
 *  3. Inside each Cluster, copy Timecode verbatim and keep only
 *     SimpleBlock/BlockGroup elements whose track number is an audio track.
 *  4. Copy SegmentInfo (duration etc.) verbatim.
 *  5. Drop SeekHead, Cues, Chapters, Tags, Attachments (they reference
 *     byte offsets that are now invalid, and are optional for playback).
 *
 * Returns { data, audioTrackCount, strippedTrackCount } or null if the
 * container has no audio tracks.
 */
function stripNonAudioStreams(
  input: Uint8Array,
  requestId: string,
): { data: Uint8Array; audioTrackCount: number; strippedTrackCount: number } | null {
  const chunks: Uint8Array[] = [];
  let pos = 0;
  let audioTrackNumbers = new Set<number>();
  let totalTracks = 0;

  // ── 1. EBML Header ──────────────────────────────────────────────────
  {
    const [id, idLen] = readVint(input, pos);
    if (id !== EBML_HEADER_ID || idLen === 0) {
      console.warn(`⚠️ [${requestId}] Not a valid EBML file (header ID mismatch)`);
      return null;
    }
    const [size, sizeLen] = readDataSize(input, pos + idLen);
    if (sizeLen === 0 || size < 0) {
      console.warn(`⚠️ [${requestId}] Invalid EBML header size`);
      return null;
    }
    const headerEnd = pos + idLen + sizeLen + size;
    chunks.push(input.slice(pos, headerEnd));
    pos = headerEnd;
  }

  // ── 2. Segment ──────────────────────────────────────────────────────
  {
    const [id, idLen] = readVint(input, pos);
    if (id !== SEGMENT_ID || idLen === 0) {
      console.warn(`⚠️ [${requestId}] Missing Segment element`);
      return null;
    }
    const [segSize, segSizeLen] = readDataSize(input, pos + idLen);
    // segSize may be -1 (unknown/streaming)
    const segPayloadStart = pos + idLen + segSizeLen;
    const segPayloadEnd = segSize < 0 ? input.length : segPayloadStart + segSize;

    // We'll collect rebuilt segment children, then wrap them in a new Segment
    const segChildren: Uint8Array[] = [];
    let segPos = segPayloadStart;

    // First pass: find Tracks element to learn audio track numbers
    let tracksPayload: Uint8Array | null = null;
    let scanPos = segPayloadStart;

    while (scanPos < Math.min(segPayloadEnd, input.length)) {
      const [eId, eIdLen] = readVint(input, scanPos);
      if (eIdLen === 0) break;
      const [eSize, eSizeLen] = readDataSize(input, scanPos + eIdLen);
      if (eSizeLen === 0) break;

      if (eId === TRACKS_ID && eSize > 0) {
        tracksPayload = input.slice(scanPos + eIdLen + eSizeLen, scanPos + eIdLen + eSizeLen + eSize);
        break;
      }

      // Skip unknown-size elements safely
      if (eSize < 0) break;
      scanPos = scanPos + eIdLen + eSizeLen + eSize;
    }

    if (!tracksPayload) {
      console.warn(`⚠️ [${requestId}] No Tracks element found in Segment`);
      return null;
    }

    const allTracks = parseTrackEntries(tracksPayload);
    totalTracks = allTracks.length;
    const audioTracks = allTracks.filter(t => t.trackType === TRACK_TYPE_AUDIO);
    audioTrackNumbers = new Set(audioTracks.map(t => t.trackNumber));

    if (audioTracks.length === 0) {
      console.warn(`⚠️ [${requestId}] No audio tracks found`);
      return null;
    }

    const strippedTracks = allTracks.filter(t => t.trackType !== TRACK_TYPE_AUDIO);
    if (strippedTracks.length > 0) {
      const labels = strippedTracks.map(t => {
        const typeLabel =
          t.trackType === TRACK_TYPE_VIDEO ? 'video' :
          t.trackType === TRACK_TYPE_SUBTITLE ? 'subtitle' :
          `type=${t.trackType}`;
        return `#${t.trackNumber}(${typeLabel})`;
      });
      console.log(`🗑️ [${requestId}] Stripping ${strippedTracks.length} non-audio track(s): ${labels.join(', ')}`);
    }

    // Rebuild Tracks element with only audio TrackEntry elements
    const audioTrackEntryBytes = concat(...audioTracks.map(t => t.rawBytes));
    const rebuiltTracksPayload = audioTrackEntryBytes;
    const rebuiltTracks = concat(
      encodeId(TRACKS_ID),
      encodeDataSize(rebuiltTracksPayload.length),
      rebuiltTracksPayload,
    );

    // Second pass: rebuild segment children
    segPos = segPayloadStart;
    let tracksEmitted = false;

    while (segPos < Math.min(segPayloadEnd, input.length)) {
      const [eId, eIdLen] = readVint(input, segPos);
      if (eIdLen === 0) break;
      const [eSize, eSizeLen] = readDataSize(input, segPos + eIdLen);
      if (eSizeLen === 0) break;

      const elementHeaderEnd = segPos + eIdLen + eSizeLen;

      // Handle unknown-size clusters (streaming WebM)
      if (eSize < 0) {
        if (eId === CLUSTER_ID) {
          // Scan for the next top-level element to find effective cluster end
          const clusterData = rebuildCluster(input, elementHeaderEnd, segPayloadEnd, audioTrackNumbers);
          if (clusterData.data.length > 0) {
            segChildren.push(concat(
              encodeId(CLUSTER_ID),
              encodeDataSize(clusterData.data.length),
              clusterData.data,
            ));
          }
          segPos = clusterData.nextPos;
          continue;
        }
        // Skip other unknown-size elements
        break;
      }

      const elementEnd = elementHeaderEnd + eSize;

      switch (eId) {
        case TRACKS_ID:
          if (!tracksEmitted) {
            segChildren.push(rebuiltTracks);
            tracksEmitted = true;
          }
          break;

        case SEGMENT_INFO_ID:
          // Copy verbatim
          segChildren.push(input.slice(segPos, elementEnd));
          break;

        case CLUSTER_ID: {
          // Rebuild cluster keeping only audio blocks
          const clusterPayload = input.slice(elementHeaderEnd, elementEnd);
          const rebuiltPayload = rebuildClusterPayload(clusterPayload, audioTrackNumbers);
          if (rebuiltPayload.length > 0) {
            segChildren.push(concat(
              encodeId(CLUSTER_ID),
              encodeDataSize(rebuiltPayload.length),
              rebuiltPayload,
            ));
          }
          break;
        }

        case SEEK_HEAD_ID:
        case CUES_ID:
        case TAGS_ID:
        case CHAPTERS_ID:
        case ATTACHMENTS_ID:
          // Drop — byte offsets are invalid after stripping, and they're optional
          break;

        default:
          // Copy unknown elements verbatim (could be Void, etc.)
          segChildren.push(input.slice(segPos, elementEnd));
          break;
      }

      segPos = elementEnd;
    }

    // Wrap everything in a Segment
    const segPayload = concat(...segChildren);
    chunks.push(concat(
      encodeId(SEGMENT_ID),
      encodeDataSize(segPayload.length),
      segPayload,
    ));
  }

  return {
    data: concat(...chunks),
    audioTrackCount: audioTrackNumbers.size,
    strippedTrackCount: totalTracks - audioTrackNumbers.size,
  };
}

/**
 * Rebuild a cluster payload, keeping only Timecode and blocks for audio tracks.
 */
function rebuildClusterPayload(payload: Uint8Array, audioTracks: Set<number>): Uint8Array {
  const parts: Uint8Array[] = [];
  let pos = 0;

  while (pos < payload.length) {
    const [id, idLen] = readVint(payload, pos);
    if (idLen === 0) break;
    const [size, sizeLen] = readDataSize(payload, pos + idLen);
    if (sizeLen === 0 || size < 0) break;

    const elementStart = pos;
    const dataStart = pos + idLen + sizeLen;
    const elementEnd = dataStart + size;

    if (id === TIMECODE_ID) {
      // Always keep the cluster timecode
      parts.push(payload.slice(elementStart, elementEnd));
    } else if (id === SIMPLE_BLOCK_ID) {
      // Check track number
      if (size > 0) {
        const tn = blockTrackNumber(payload.slice(dataStart, elementEnd));
        if (audioTracks.has(tn)) {
          parts.push(payload.slice(elementStart, elementEnd));
        }
      }
    } else if (id === BLOCK_GROUP_ID) {
      // Parse BlockGroup children to find the Block, check its track number
      const bgPayload = payload.slice(dataStart, elementEnd);
      let bgPos = 0;
      let isAudio = false;

      while (bgPos < bgPayload.length) {
        const [bgId, bgIdLen] = readVint(bgPayload, bgPos);
        if (bgIdLen === 0) break;
        const [bgSize, bgSizeLen] = readDataSize(bgPayload, bgPos + bgIdLen);
        if (bgSizeLen === 0 || bgSize < 0) break;

        if (bgId === BLOCK_ID && bgSize > 0) {
          const blockData = bgPayload.slice(bgPos + bgIdLen + bgSizeLen, bgPos + bgIdLen + bgSizeLen + bgSize);
          const tn = blockTrackNumber(blockData);
          if (audioTracks.has(tn)) {
            isAudio = true;
          }
        }
        bgPos = bgPos + bgIdLen + bgSizeLen + bgSize;
      }

      if (isAudio) {
        parts.push(payload.slice(elementStart, elementEnd));
      }
    } else {
      // Keep other cluster children (e.g., Position, PrevSize) — they're small metadata
      parts.push(payload.slice(elementStart, elementEnd));
    }

    pos = elementEnd;
  }

  return parts.length > 0 ? concat(...parts) : new Uint8Array(0);
}

/**
 * Handle an unknown-size cluster by scanning for the next top-level element.
 */
function rebuildCluster(
  input: Uint8Array,
  payloadStart: number,
  segEnd: number,
  audioTracks: Set<number>,
): { data: Uint8Array; nextPos: number } {
  // Scan until we find the next top-level element (Cluster, Cues, etc.)
  const topLevelIds = new Set([CLUSTER_ID, CUES_ID, TAGS_ID, CHAPTERS_ID, SEEK_HEAD_ID, SEGMENT_INFO_ID, TRACKS_ID, ATTACHMENTS_ID]);
  let endPos = segEnd;
  let scanPos = payloadStart;

  // Try to find where this cluster ends
  while (scanPos < segEnd) {
    const [eId, eIdLen] = readVint(input, scanPos);
    if (eIdLen === 0) break;

    // Check if this looks like a top-level element (but not part of cluster children)
    if (topLevelIds.has(eId) && scanPos > payloadStart + 4) {
      endPos = scanPos;
      break;
    }

    const [eSize, eSizeLen] = readDataSize(input, scanPos + eIdLen);
    if (eSizeLen === 0 || eSize < 0) {
      // Can't determine size, consume rest
      endPos = segEnd;
      break;
    }
    scanPos = scanPos + eIdLen + eSizeLen + eSize;
  }

  const clusterPayload = input.slice(payloadStart, endPos);
  const rebuiltPayload = rebuildClusterPayload(clusterPayload, audioTracks);

  return {
    data: rebuiltPayload,
    nextPos: endPos,
  };
}

// ── Format detection ─────────────────────────────────────────────────

function detectFormat(bytes: Uint8Array): { mimeType: string; extension: string; isContainer: boolean } {
  if (bytes.length < 12) {
    return { mimeType: 'application/octet-stream', extension: 'bin', isContainer: false };
  }

  // WebM/MKV: EBML header 0x1A45DFA3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return { mimeType: 'audio/webm', extension: 'webm', isContainer: true };
  }
  // WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { mimeType: 'audio/wav', extension: 'wav', isContainer: false };
  }
  // OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { mimeType: 'audio/ogg', extension: 'ogg', isContainer: false };
  }
  // FLAC
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { mimeType: 'audio/flac', extension: 'flac', isContainer: false };
  }
  // MP4/M4A
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mimeType: 'audio/mp4', extension: 'm4a', isContainer: true };
  }
  // MP3
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)
  ) {
    return { mimeType: 'audio/mpeg', extension: 'mp3', isContainer: false };
  }

  return { mimeType: 'application/octet-stream', extension: 'bin', isContainer: false };
}

function normaliseMimeType(raw: string): { mimeType: string; extension: string } {
  const lower = (raw || '').toLowerCase().split(';')[0].trim();

  if (lower.includes('webm')) return { mimeType: 'audio/webm', extension: 'webm' };
  if (lower.includes('flac')) return { mimeType: 'audio/flac', extension: 'flac' };
  if (lower.includes('wav')) return { mimeType: 'audio/wav', extension: 'wav' };
  if (lower.includes('ogg')) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (lower.includes('m4a')) return { mimeType: 'audio/m4a', extension: 'm4a' };
  if (lower.includes('aac')) return { mimeType: 'audio/aac', extension: 'aac' };
  if (lower.includes('mp4')) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if (lower.includes('mp3') || lower.includes('mpeg')) return { mimeType: 'audio/mpeg', extension: 'mp3' };

  return { mimeType: lower || 'application/octet-stream', extension: 'bin' };
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`🔄 [${requestId}] transcode-audio: request received`);

    // Accept FormData (field: 'file') or raw binary body
    let audioBytes: Uint8Array;
    let declaredMime = '';

    const ct = req.headers.get('content-type') || '';

    if (ct.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | Blob | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file field in FormData' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBytes = new Uint8Array(await file.arrayBuffer());
      declaredMime = (file as File).type || '';
    } else {
      audioBytes = new Uint8Array(await req.arrayBuffer());
      declaredMime = ct.split(';')[0].trim();
    }

    // Size checks
    if (audioBytes.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty audio data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audioBytes.length > MAX_INPUT_BYTES) {
      console.error(`❌ [${requestId}] Audio exceeds 24MB limit: ${(audioBytes.length / 1024 / 1024).toFixed(2)}MB`);
      return new Response(JSON.stringify({
        error: 'Audio file too large',
        size: audioBytes.length,
        maxSize: MAX_INPUT_BYTES,
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audioBytes.length > WARN_BYTES) {
      console.warn(`⚠️ [${requestId}] Large audio file: ${(audioBytes.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Detect format from magic bytes
    const detected = detectFormat(audioBytes);
    const declared = normaliseMimeType(declaredMime);

    const finalMime = detected.mimeType !== 'application/octet-stream'
      ? detected.mimeType
      : declared.mimeType;
    const finalExt = detected.extension !== 'bin'
      ? detected.extension
      : declared.extension;

    const originalSize = audioBytes.length;
    let tracksStripped = 0;
    let wasProcessed = false;

    console.log(`📊 [${requestId}] Audio: ${(audioBytes.length / 1024).toFixed(1)}KB, declared=${declaredMime}, detected=${detected.mimeType}, container=${detected.isContainer}`);

    // ── Stream stripping for WebM/MKV containers ──────────────────────
    if (detected.isContainer && detected.mimeType === 'audio/webm') {
      console.log(`🔧 [${requestId}] WebM container detected — stripping non-audio streams`);
      try {
        const result = stripNonAudioStreams(audioBytes, requestId);
        if (result) {
          tracksStripped = result.strippedTrackCount;
          if (tracksStripped > 0) {
            const savedKB = ((originalSize - result.data.length) / 1024).toFixed(1);
            console.log(`✅ [${requestId}] Stripped ${tracksStripped} non-audio track(s), kept ${result.audioTrackCount} audio track(s). Saved ${savedKB}KB`);
            audioBytes = result.data;
            wasProcessed = true;
          } else {
            console.log(`ℹ️ [${requestId}] Container is audio-only (${result.audioTrackCount} audio track(s)), no stripping needed`);
          }
        } else {
          console.warn(`⚠️ [${requestId}] EBML parsing failed — passing through raw audio`);
        }
      } catch (stripErr) {
        console.warn(`⚠️ [${requestId}] Stream stripping error (passing through raw): ${stripErr}`);
      }
    } else {
      console.log(`ℹ️ [${requestId}] Non-container format (${finalMime}) — no stream stripping needed`);
    }

    console.log(`✅ [${requestId}] Returning audio: ${finalMime}, ${(audioBytes.length / 1024).toFixed(1)}KB, stripped=${tracksStripped}, processed=${wasProcessed}`);

    return new Response(audioBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': finalMime,
        'X-Audio-Extension': finalExt,
        'X-Audio-Transcoded': String(wasProcessed),
        'X-Audio-Tracks-Stripped': String(tracksStripped),
        'X-Audio-Original-Size': String(originalSize),
        'X-Audio-Format-Detected': detected.mimeType,
        'X-Audio-Format-Declared': declaredMime,
      },
    });
  } catch (err) {
    console.error(`❌ [${requestId}] transcode-audio error:`, err);
    return new Response(JSON.stringify({
      error: 'Transcoding failed',
      message: String(err?.message || err),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
