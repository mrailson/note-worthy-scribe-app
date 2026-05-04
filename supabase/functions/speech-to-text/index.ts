import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client',
};

// ── Preprocessing helper ────────────────────────────────────────────────────

function inferExtension(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('flac')) return 'flac';
  if (m.includes('webm')) return 'webm';
  if (m.includes('wav')) return 'wav';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('m4a') || m.includes('mp4') || m.includes('aac')) return 'm4a';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  return 'bin';
}

/**
 * Preprocess audio through the transcode-audio service.
 * Always enabled — strips non-audio streams (-sn -dn) before Whisper.
 * Falls back to direct forward on error/timeout.
 */
async function preprocessAudioViaTranscode(
  audioBytes: Uint8Array,
  declaredMime: string,
  requestId: string
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string; preprocessed: boolean }> {

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    console.warn(`⚠️ [${requestId}] Missing SUPABASE_URL or SUPABASE_ANON_KEY, skipping preprocessing`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }

  const transcodeUrl = `${supabaseUrl}/functions/v1/transcode-audio`;
  console.log(`🔄 [${requestId}] Preprocessing: sending ${audioBytes.length}B (${declaredMime}) to transcode-audio…`);

  try {
    const fd = new FormData();
    fd.append('file', new Blob([audioBytes], { type: declaredMime }), 'input.audio');

    const response = await fetch(transcodeUrl, {
      method: 'POST',
      headers: { 'apikey': anonKey },
      body: fd,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`⚠️ [${requestId}] transcode-audio error ${response.status}: ${errBody.slice(0, 200)}, falling back to direct forward`);
      return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
    }

    const resultBytes = new Uint8Array(await response.arrayBuffer());
    const resultMime = response.headers.get('Content-Type') || declaredMime;
    const resultExt = response.headers.get('X-Audio-Extension') || inferExtension(resultMime);
    const wasTranscoded = response.headers.get('X-Audio-Transcoded') === 'true';

    console.log(`✅ [${requestId}] Preprocessing complete: ${audioBytes.length}B → ${resultBytes.length}B, ${declaredMime} → ${resultMime} (.${resultExt}), transcoded=${wasTranscoded}`);
    return { bytes: resultBytes, mimeType: resultMime, extension: resultExt, preprocessed: true };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.warn(`⚠️ [${requestId}] transcode-audio ${isTimeout ? 'timed out' : 'failed'}: ${err?.message || err}, falling back to direct forward`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

// ── WAV header helpers ──────────────────────────────────────────────────────

function parseWavHeader(buf: Uint8Array): { sampleRate: number; numChannels: number; bitsPerSample: number; dataOffset: number; dataSize: number } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Find "data" sub-chunk
  let dataOffset = 12; // skip RIFF header
  let dataSize = 0;
  while (dataOffset < buf.length - 8) {
    const chunkId = String.fromCharCode(buf[dataOffset], buf[dataOffset + 1], buf[dataOffset + 2], buf[dataOffset + 3]);
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      dataOffset += 8;
      dataSize = chunkSize;
      break;
    }
    dataOffset += 8 + chunkSize;
    if (dataOffset % 2 !== 0) dataOffset++; // pad byte
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

// ── Whisper single-chunk transcription (reused by both paths) ───────────────

async function transcribeChunkViaWhisper(
  audioBytes: Uint8Array,
  mimeType: string,
  extension: string,
  fileName: string,
  apiKey: string,
  language: string,
  requestId: string,
): Promise<{ text: string; duration: number }> {
  const formData = new FormData();
  const audioBlob = new Blob([audioBytes], { type: mimeType });
  formData.append('file', audioBlob, fileName || `audio.${extension}`);
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  formData.append('prompt', language === 'en'
    ? 'UK GP consultation. NHS primary care. Clinical terms: SNOMED, NICE guidelines, BNF, QoF, PCN, hypertension, diabetes mellitus, COPD, CKD, atrial fibrillation. GP systems: SystmOne, EMIS. UK spellings.'
    : 'Healthcare conversation. Medical consultation.');

  let response: Response | undefined;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`💰 [${requestId}] WHISPER_API_CALL: attempt=${attempt}/${3}, file=${fileName}, bytes=${audioBytes.length}`);
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(120000),
      });
      if (response.ok) break;
      const errText = await response.text();
      if (response.status >= 400 && response.status < 500) throw new Error(`Whisper ${response.status}: ${errText}`);
      lastError = new Error(`Whisper ${response.status}: ${errText}`);
    } catch (e: any) {
      lastError = e;
    }
    if (attempt < 3) {
      console.log(`⚠️ [${requestId}] WHISPER_RETRY: attempt=${attempt} failed, retrying in ${Math.pow(2, attempt - 1)}s. Status=${response?.status || 'no_response'}, error=${lastError?.message || 'unknown'}`);
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  if (!response || !response.ok) throw lastError || new Error('Whisper failed after retries');
  const result = await response.json();
  const costEstimate = (result.duration / 60) * 0.006;
  console.log(`💰 [${requestId}] WHISPER_COST_LOG: duration=${result.duration.toFixed(1)}s, est_cost=$${costEstimate.toFixed(4)}, text_len=${result.text.length}, file=${fileName}`);
  return { text: result.text || '', duration: result.duration || 0 };
}

// ── Large-audio handler ─────────────────────────────────────────────────────

async function handleLargeAudio(
  storagePath: string,
  fileName: string,
  apiKey: string,
  language: string,
  requestId: string,
): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  console.log(`📥 [${requestId}] Downloading ${storagePath} from audio-imports bucket…`);

  // Download from storage
  const downloadUrl = `${supabaseUrl}/storage/v1/object/audio-imports/${storagePath}`;
  const dlResp = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
  });
  if (!dlResp.ok) throw new Error(`Storage download failed: ${dlResp.status} ${await dlResp.text()}`);
  const fileBytes = new Uint8Array(await dlResp.arrayBuffer());
  console.log(`📦 [${requestId}] Downloaded ${fileBytes.length} bytes`);

  try {
    // Check if it's a WAV file by looking for RIFF header
    const isWav = fileBytes.length >= 4 &&
      String.fromCharCode(fileBytes[0], fileBytes[1], fileBytes[2], fileBytes[3]) === 'RIFF';

    if (!isWav) {
      // Non-WAV file (e.g. m4a, mp3): preprocess then send whole file to Whisper
      console.log(`🎵 [${requestId}] Non-WAV file (${fileName}), ${(fileBytes.length / 1024 / 1024).toFixed(1)}MB — sending directly to Whisper`);

      const ext = (fileName || '').split('.').pop()?.toLowerCase() || 'bin';
      const mimeMap: Record<string, string> = {
        m4a: 'audio/m4a', mp3: 'audio/mpeg', mp4: 'audio/mp4',
        ogg: 'audio/ogg', webm: 'audio/webm', aac: 'audio/aac',
        wav: 'audio/wav', flac: 'audio/flac',
      };
      const mime = mimeMap[ext] || 'audio/mpeg';

      // Preprocess through transcode-audio
      const preprocessed = await preprocessAudioViaTranscode(fileBytes, mime, requestId);

      const result = await transcribeChunkViaWhisper(
        preprocessed.bytes, preprocessed.mimeType, preprocessed.extension,
        fileName || `audio.${ext}`, apiKey, language, requestId
      );

      console.log(`✅ [${requestId}] Non-WAV transcription complete: ${result.text.length} chars, ${result.duration.toFixed(1)}s`);

      return new Response(
        JSON.stringify({ text: result.text, duration: result.duration, chunks: 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // WAV file: parse header and chunk
    const wav = parseWavHeader(fileBytes);
    const TARGET_CHUNK = 20 * 1024 * 1024; // 20MB
    const chunkDataSize = Math.floor(TARGET_CHUNK / (wav.numChannels * (wav.bitsPerSample / 8))) * (wav.numChannels * (wav.bitsPerSample / 8));
    const totalDataSize = Math.min(wav.dataSize, fileBytes.length - wav.dataOffset);
    const numChunks = Math.ceil(totalDataSize / chunkDataSize);

    console.log(`🎵 [${requestId}] WAV: ${wav.sampleRate}Hz, ${wav.numChannels}ch, ${wav.bitsPerSample}bit, ${(totalDataSize / 1024 / 1024).toFixed(1)}MB PCM, ${numChunks} chunks`);

    const transcripts: string[] = [];
    let totalDuration = 0;

    for (let i = 0; i < numChunks; i++) {
      const start = wav.dataOffset + i * chunkDataSize;
      const end = Math.min(start + chunkDataSize, wav.dataOffset + totalDataSize);
      const pcmSlice = fileBytes.slice(start, end);
      const chunkHeader = buildWavHeader(pcmSlice.length, wav.sampleRate, wav.numChannels, wav.bitsPerSample);

      const chunkFile = new Uint8Array(chunkHeader.length + pcmSlice.length);
      chunkFile.set(chunkHeader);
      chunkFile.set(pcmSlice, chunkHeader.length);

      console.log(`🔄 [${requestId}] Transcribing chunk ${i + 1}/${numChunks} (${(chunkFile.length / 1024 / 1024).toFixed(1)}MB)…`);

      const result = await transcribeChunkViaWhisper(
        chunkFile, 'audio/wav', 'wav', `chunk_${i}.wav`, apiKey, language, requestId
      );

      if (result.text.trim()) transcripts.push(result.text.trim());
      totalDuration += result.duration;
      console.log(`✅ [${requestId}] Chunk ${i + 1} done: ${result.text.length} chars, ${result.duration.toFixed(1)}s`);
    }

    const combinedText = transcripts.join('\n');
    console.log(`✅ [${requestId}] All ${numChunks} chunks complete: ${combinedText.length} chars, ${totalDuration.toFixed(1)}s total`);

    return new Response(
      JSON.stringify({ text: combinedText, duration: totalDuration, chunks: numChunks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    // Always delete temp file
    console.log(`🗑️ [${requestId}] Deleting temp file: ${storagePath}`);
    try {
      const deleteUrl = `${supabaseUrl}/storage/v1/object/audio-imports/${storagePath}`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      });
    } catch (e) {
      console.warn(`⚠️ [${requestId}] Failed to delete temp file:`, e);
    }
  }
}

// ── UK English spelling normaliser ─────────────────────────────────────────
// Post-processes Whisper output to enforce British English spellings,
// regardless of how strongly the model's training prior pulls toward US
// spellings on any given word. Applied before the response is returned,
// so callers always receive UK-spelled text. Word-boundary regex,
// case-preserving (Organization → Organisation, ORGANIZATION → ORGANISATION).
//
// Tier 1: -ise/-ize, -our, -re, judgment family. Always swap.
// Tier 2: medical/clinical UK spellings (anaemia, oedema, paediatric...). Always swap.
// Tier 3 (deliberately omitted): practice/practise, program/programme,
//   meter/metre, tire/tyre, license/licence — verb/noun ambiguity, would
//   regress correct English. Leave alone.
const UK_SPELLINGS: ReadonlyArray<[string, string]> = [
  // -ise / -ize family
  ['organize', 'organise'], ['organized', 'organised'], ['organizing', 'organising'],
  ['organizes', 'organises'], ['organization', 'organisation'],
  ['organizations', 'organisations'], ['organizational', 'organisational'],
  ['recognize', 'recognise'], ['recognized', 'recognised'],
  ['recognizing', 'recognising'], ['recognizes', 'recognises'],
  ['realize', 'realise'], ['realized', 'realised'],
  ['realizing', 'realising'], ['realizes', 'realises'],
  ['apologize', 'apologise'], ['apologized', 'apologised'], ['apologizing', 'apologising'],
  ['analyze', 'analyse'], ['analyzed', 'analysed'], ['analyzing', 'analysing'],
  ['prioritize', 'prioritise'], ['prioritized', 'prioritised'], ['prioritizing', 'prioritising'],
  ['utilize', 'utilise'], ['utilized', 'utilised'],
  ['minimize', 'minimise'], ['minimized', 'minimised'],
  ['maximize', 'maximise'], ['maximized', 'maximised'],
  ['authorize', 'authorise'], ['authorized', 'authorised'],
  ['characterize', 'characterise'],
  ['specialize', 'specialise'], ['specialized', 'specialised'],
  ['standardize', 'standardise'], ['summarize', 'summarise'],
  // -our family
  ['color', 'colour'], ['colors', 'colours'], ['colored', 'coloured'], ['coloring', 'colouring'],
  ['behavior', 'behaviour'], ['behaviors', 'behaviours'], ['behavioral', 'behavioural'],
  ['favor', 'favour'], ['favors', 'favours'], ['favored', 'favoured'],
  ['favoring', 'favouring'], ['favorite', 'favourite'], ['favorites', 'favourites'],
  ['honor', 'honour'], ['honors', 'honours'], ['honored', 'honoured'],
  ['humor', 'humour'], ['humored', 'humoured'],
  ['labor', 'labour'], ['labors', 'labours'], ['labored', 'laboured'],
  ['neighbor', 'neighbour'], ['neighbors', 'neighbours'],
  ['neighborhood', 'neighbourhood'], ['neighborhoods', 'neighbourhoods'],
  ['rumor', 'rumour'], ['rumors', 'rumours'],
  ['flavor', 'flavour'], ['flavors', 'flavours'], ['flavored', 'flavoured'],
  // -re family
  ['center', 'centre'], ['centers', 'centres'], ['centered', 'centred'], ['centering', 'centring'],
  ['fiber', 'fibre'], ['fibers', 'fibres'],
  ['liter', 'litre'], ['liters', 'litres'],
  ['theater', 'theatre'], ['theaters', 'theatres'],
  // judgment family
  ['judgment', 'judgement'], ['judgments', 'judgements'], ['judgmental', 'judgemental'],
  ['acknowledgment', 'acknowledgement'], ['acknowledgments', 'acknowledgements'],
  // misc Tier 1
  ['aluminum', 'aluminium'], ['gray', 'grey'],
  ['plow', 'plough'], ['mold', 'mould'], ['molded', 'moulded'],
  // medical / clinical (Tier 2)
  ['anemia', 'anaemia'], ['anemic', 'anaemic'],
  ['anesthesia', 'anaesthesia'], ['anesthetic', 'anaesthetic'],
  ['anesthetist', 'anaesthetist'], ['anesthetize', 'anaesthetise'],
  ['celiac', 'coeliac'],
  ['diarrhea', 'diarrhoea'],
  ['edema', 'oedema'],
  ['esophagus', 'oesophagus'], ['esophageal', 'oesophageal'],
  ['estrogen', 'oestrogen'],
  ['feces', 'faeces'], ['fecal', 'faecal'],
  ['fetus', 'foetus'], ['fetal', 'foetal'],
  ['hemoglobin', 'haemoglobin'],
  ['hematology', 'haematology'], ['hematologist', 'haematologist'],
  ['hematoma', 'haematoma'], ['hemorrhage', 'haemorrhage'],
  ['hemorrhoids', 'haemorrhoids'],
  ['leukemia', 'leukaemia'],
  ['orthopedic', 'orthopaedic'],
  ['pediatric', 'paediatric'], ['pediatrics', 'paediatrics'],
  ['pediatrician', 'paediatrician'],
  ['tumor', 'tumour'], ['tumors', 'tumours'],
  // -ence family
  ['pretense', 'pretence'], ['defense', 'defence'],
  // doubled-l UK spellings
  ['fulfill', 'fulfil'], ['fulfillment', 'fulfilment'],
  ['instill', 'instil'],
  ['enrollment', 'enrolment'], ['enroll', 'enrol'],
  ['skillful', 'skilful'], ['willful', 'wilful'],
  ['traveler', 'traveller'], ['travelers', 'travellers'],
  ['traveling', 'travelling'], ['traveled', 'travelled'],
  ['modeling', 'modelling'], ['modeled', 'modelled'],
  ['labeling', 'labelling'], ['labeled', 'labelled'],
];
const UK_SPELLINGS_MAP: ReadonlyMap<string, string> = new Map(UK_SPELLINGS);
const UK_SPELLINGS_REGEX = new RegExp(
  '\\b(' + UK_SPELLINGS.map(([from]) => from).join('|') + ')\\b',
  'gi'
);
function applyUKSpellings(text: string): string {
  if (!text) return text;
  return text.replace(UK_SPELLINGS_REGEX, (match) => {
    const replacement = UK_SPELLINGS_MAP.get(match.toLowerCase());
    if (!replacement) return match;
    // Preserve case: ORGANIZATION → ORGANISATION, Organization → Organisation
    if (match === match.toUpperCase()) return replacement.toUpperCase();
    if (match[0] === match[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`📨 [${requestId}] SPEECH-TO-TEXT: Request received: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error(`❌ [${requestId}] OpenAI API key not found`);
      throw new Error('OpenAI API key not configured');
    }

    const body = await req.json();

    // ── Large-audio branch ──
    if (body.action === 'process-large-audio') {
      const { storagePath, fileName: fn } = body;
      if (!storagePath) throw new Error('storagePath is required for process-large-audio');
      return await handleLargeAudio(storagePath, fn || 'audio.wav', OPENAI_API_KEY, body.language || 'en', requestId);
    }

    // ── Default base64 branch (unchanged) ──
    const { audio, mimeType, fileName, language, prompt: callerPrompt } = body;

    if (!audio) {
      console.error(`❌ [${requestId}] No audio data provided`);
      throw new Error('No audio data provided');
    }

    const transcriptionLanguage = language || 'en';

    console.log(`📊 [${requestId}] Audio received: size=${audio.length} chars, mime=${mimeType || 'not provided'}, file=${fileName || 'not provided'}, lang=${transcriptionLanguage}`);

    // Convert base64 to binary
    const binaryString = atob(audio);
    const rawBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      rawBytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`📦 [${requestId}] Raw audio buffer: ${rawBytes.length} bytes`);

    // ── Preprocess through transcode-audio ──
    // Use application/octet-stream as default if no MIME provided (avoids mislabelling iOS audio as webm)
    const declaredMime = mimeType || 'application/octet-stream';
    const preprocessed = await preprocessAudioViaTranscode(rawBytes, declaredMime, requestId);

    // Use preprocessed output for MIME/extension
    let detectedMimeType = preprocessed.mimeType;
    let fileExtension = preprocessed.extension;

    // If preprocessing was NOT used (disabled or failed), apply local MIME mapping as before
    if (!preprocessed.preprocessed) {
      const lowerMime = (detectedMimeType || '').toLowerCase();
      if (lowerMime.includes('flac')) { detectedMimeType = 'audio/flac'; fileExtension = 'flac'; }
      else if (lowerMime.includes('mp3') || lowerMime.includes('mpeg')) { detectedMimeType = 'audio/mpeg'; fileExtension = 'mp3'; }
      else if (lowerMime.includes('wav')) { detectedMimeType = 'audio/wav'; fileExtension = 'wav'; }
      else if (lowerMime.includes('m4a')) { detectedMimeType = 'audio/m4a'; fileExtension = 'm4a'; }
      else if (lowerMime.includes('aac')) { detectedMimeType = 'audio/aac'; fileExtension = 'aac'; }
      else if (lowerMime.includes('mp4')) { detectedMimeType = 'audio/mp4'; fileExtension = 'm4a'; }
      else if (lowerMime.includes('ogg')) { detectedMimeType = 'audio/ogg'; fileExtension = 'ogg'; }
      else if (lowerMime.includes('webm')) { detectedMimeType = 'audio/webm'; fileExtension = 'webm'; }
      // If still octet-stream, default to webm (most common browser format)
      else if (lowerMime === 'application/octet-stream') { detectedMimeType = 'audio/webm'; fileExtension = 'webm'; }

      // If we have a fileName, try to extract extension from it
      if (fileName) {
        const fileNameExt = fileName.split('.').pop()?.toLowerCase();
        if (fileNameExt === 'mp3' || fileNameExt === 'wav' || fileNameExt === 'm4a' || fileNameExt === 'ogg' || fileNameExt === 'webm' || fileNameExt === 'flac') {
          fileExtension = fileNameExt;
          if (fileNameExt === 'mp3') detectedMimeType = 'audio/mpeg';
          else if (fileNameExt === 'wav') detectedMimeType = 'audio/wav';
          else if (fileNameExt === 'm4a') detectedMimeType = 'audio/m4a';
          else if (fileNameExt === 'ogg') detectedMimeType = 'audio/ogg';
          else if (fileNameExt === 'webm') detectedMimeType = 'audio/webm';
          else if (fileNameExt === 'flac') detectedMimeType = 'audio/flac';
        }
      }
    }

    console.log(`🎵 [${requestId}] Forwarding to OpenAI as: ${detectedMimeType} (.${fileExtension}), ${preprocessed.bytes.length}B, preprocessed=${preprocessed.preprocessed}`);

    // Create form data for OpenAI API
    const formData = new FormData();
    const audioBlob = new Blob([preprocessed.bytes], { type: detectedMimeType });
    formData.append('file', audioBlob, `audio.${fileExtension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', transcriptionLanguage);
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0');

    // Build language-appropriate prompt. Server-side default covers clinical
    // GP context. If the caller supplies its own prompt (e.g. a meeting
    // recorder passing meeting title and attendee names) it is PREPENDED to
    // the default, so caller context lands in the most heavily-weighted
    // position in Whisper's 224-token effective window while the clinical
    // terms remain available behind it.
    let whisperPrompt: string;
    if (transcriptionLanguage === 'en') {
      const defaultUkPrompt = `UK English NHS conversation. British spellings throughout.

UK spellings: judgement, organisation, organise, recognise, programme, behaviour, neighbourhood, centre, colour, favour, litre, metre, practise, haemoglobin, haematology, paediatric, paediatrics, orthopaedic, oedema, coeliac, diarrhoea, anaemia, oesophagus, faeces.

NHS primary care context: PCN, primary care network, ICB, integrated care board, ICS, integrated care system, CQC, NICE, BNF, QoF, QOF, DES, LES, ARRS, GMS, MoU, DPIA, DTAC, NRES, neighbourhood team, workstream, safeguarding, dispensing, enhanced access, social prescribing, clinical pharmacist, controlled drugs.

Clinical terms: SNOMED, hypertension, hyperlipidaemia, hypothyroidism, diabetes mellitus, type 2 diabetes, ischaemic heart disease, IHD, COPD, chronic obstructive pulmonary disease, asthma, chronic kidney disease, CKD, atrial fibrillation, AF, angina, myocardial infarction, heart failure, osteoarthritis, rheumatoid arthritis, fibromyalgia, depression, anxiety, insomnia.

Medications: metformin, gliclazide, ramipril, lisinopril, amlodipine, atorvastatin, simvastatin, omeprazole, lansoprazole, levothyroxine, bisoprolol, doxazosin, bendroflumethiazide, amoxicillin, flucloxacillin, co-amoxiclav, clarithromycin, doxycycline, prednisolone, salbutamol, Ventolin, Seretide, tiotropium, apixaban, rivaroxaban, warfarin, clopidogrel, aspirin.

Tests: FBC, full blood count, U&Es, urea and electrolytes, LFTs, liver function tests, TFTs, thyroid function tests, HbA1c, eGFR, lipid profile, cholesterol, PSA, urine dipstick, MSU, ECG, electrocardiogram, spirometry, peak flow, blood pressure, BP.

GP systems: SystmOne, EMIS, EMIS Web, eConsult, AccuRx, Docman, TeamNet, Ardens.

Abbreviations: F2F, face to face, T/C, telephone consultation, DNA, did not attend, DNW, FU, follow up, follow-up, Rx, prescription, Hx, history, PMH, past medical history, DH, drug history, SH, social history, FH, family history, O/E, on examination, SOAP, NAD, nothing abnormal detected, TBC, to be confirmed, TCI, to come in, OOH, out of hours, A&E, GP, HCA, healthcare assistant, ANP, advanced nurse practitioner.

Examination terms: auscultation, palpation, percussion, bilateral, unilateral, tenderness, guarding, rebound, crepitations, crackles, wheeze, rhonchi, oedema, erythema, pallor, cyanosis, jaundice, clubbing.`;

      // Caller may supply meeting/consultation context (names, agenda, prior
      // chunk tail). Prepend it so it sits in Whisper's most-attended region.
      const callerPart = (typeof callerPrompt === 'string' && callerPrompt.trim().length > 0)
        ? callerPrompt.trim() + ' '
        : '';
      whisperPrompt = callerPart + defaultUkPrompt;
    } else {
      whisperPrompt = `Healthcare conversation. Medical consultation. Patient speaking.`;
    }
    formData.append('prompt', whisperPrompt);

    console.log(`📡 [${requestId}] Sending to OpenAI Whisper API…`);

    // Retry logic with exponential backoff
    let response;
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`💰 [${requestId}] WHISPER_API_CALL_MAIN: attempt=${attempt}/${maxRetries}, ext=${fileExtension}, bytes=${preprocessed.bytes.length}`);
      try {
        console.log(`🔄 [${requestId}] Attempt ${attempt}/${maxRetries}`);

        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: formData,
          signal: AbortSignal.timeout(120000),
        });

        console.log(`📨 [${requestId}] OpenAI response status: ${response.status}`);

        if (response.ok) break;

        const errorText = await response.text();
        console.error(`❌ [${requestId}] OpenAI API error (attempt ${attempt}): ${response.status} ${errorText}`);

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenAI API client error: ${response.status} - ${errorText}`);
        }

        lastError = new Error(`OpenAI API error: ${response.status} - ${errorText}`);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⚠️ [${requestId}] WHISPER_RETRY_MAIN: attempt=${attempt} failed, retrying in ${Math.pow(2, attempt - 1)}s. Status=${response?.status || 'no_response'}, error=${lastError?.message || 'unknown'}`);
          console.log(`⏳ [${requestId}] Waiting ${delay}ms before retry…`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        console.error(`❌ [${requestId}] Network/timeout error (attempt ${attempt}):`, error);
        lastError = error;
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`⏳ [${requestId}] Timeout/abort - retrying after ${delay}ms…`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            break;
          }
        }
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ [${requestId}] Waiting ${delay}ms before retry…`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response || !response.ok) {
      console.error(`❌ [${requestId}] All retry attempts failed`);
      throw lastError || new Error('Failed to connect to OpenAI API after all retries');
    }

    const result = await response.json();
    console.log(`✅ [${requestId}] Transcription successful, text length: ${result.text?.length || 0}`);
    console.log(`📝 [${requestId}] Transcript preview: ${result.text?.slice(0, 100)}…`);

    // Cost tracking — log billed duration and estimated cost per chunk
    const billedDuration = result.duration || 0;
    const estCost = (billedDuration / 60) * 0.006;
    console.log(`💰 [${requestId}] WHISPER_COST_LOG: billed_duration=${billedDuration.toFixed(1)}s, est_cost=$${estCost.toFixed(4)}, text_len=${result.text?.length || 0}, bytes_sent=${preprocessed.bytes.length}, ext=${fileExtension}`);

    // Calculate real confidence from segments
    let confidence = 0.5;
    let avg_logprob = -0.3;
    let no_speech_prob = 0.3;

    if (result.segments && result.segments.length > 0) {
      avg_logprob = result.segments.reduce((sum: number, seg: any) =>
        sum + (seg.avg_logprob || -2), 0) / result.segments.length;
      no_speech_prob = result.segments.reduce((sum: number, seg: any) =>
        sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;

      confidence = Math.max(0, Math.min(1,
        (avg_logprob + 1) / 1 * (1 - no_speech_prob)
      ));
    }

    let segments = result.segments || [];
    let finalText: string = result.text || '';
    let hallucinationDetected = false;

    // Comprehensive hallucination detection patterns
    const HALLUCINATION_PHRASES = [
      'thank you for watching', 'thanks for watching', 'thank you for listening',
      'thanks for listening', 'thank you for your time', 'thank you for joining',
      'please subscribe', 'like and subscribe', 'don\'t forget to subscribe',
      'see you in the next video', 'see you next time', 'until next time',
      'i hope you enjoyed', 'this concludes', 'end of presentation',
      'leave a comment', 'hit the like button', 'smash the like button',
      'check out the link', 'link in the description', 'brought to you by',
      'subtitles by', 'transcribed by', 'captions by',
      'welcome to my channel', 'welcome back to my channel',
      '[music]', '[applause]', '[laughter]', '[silence]',
      'music playing', 'background music', 'upbeat music',
    ];

    if (finalText) {
      const lowerText = finalText.toLowerCase();
      const textWordCount = finalText.split(/\s+/).filter(Boolean).length;
      // Content-rich chunks (≥120 words) are always kept — downstream dedup handles repetition
      const isContentRich = textWordCount >= 120;
      
      for (const phrase of HALLUCINATION_PHRASES) {
        if (lowerText.includes(phrase)) {
          console.log(`🚫 [${requestId}] Hallucination phrase detected: "${phrase}"`);
          hallucinationDetected = true;
          if (finalText.length < 100 && !isContentRich) {
            finalText = '';
            confidence = 0.0;
            segments = [];
          }
          break;
        }
      }
    }

    // Detect and clean repeated-phrase hallucinations
    if (finalText && finalText.length > 0) {
      const collapseRepeatedClauses = (text: string) => {
        const clauses = text
          .split(/(?<=[.!?])\s+|,\s+/)
          .map((part: string) => part.trim())
          .filter(Boolean);

        if (clauses.length < 4) {
          return { text, removed: 0 };
        }

        const normaliseClause = (value: string) =>
          value
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const seen = new Set<string>();
        const deduped: string[] = [];
        let removed = 0;

        for (const clause of clauses) {
          const normalised = normaliseClause(clause);
          if (!normalised) continue;

          if (seen.has(normalised)) {
            removed += 1;
            continue;
          }

          seen.add(normalised);
          deduped.push(clause);
        }

        const cleaned = deduped.join(', ').replace(/\s+/g, ' ').trim();
        return { text: cleaned || text, removed };
      };

      const words = finalText.toLowerCase().split(/\s+/).filter(Boolean);
      const isContentRich = words.length >= 120;

      const pcnCount = (finalText.match(/\bpcn\b/gi) || []).length;
      const nmhtCount = (finalText.match(/\bnmht\b/gi) || []).length;
      const totalHallucinationTerms = pcnCount + nmhtCount;

      const hallucinationRatio = words.length > 0 ? totalHallucinationTerms / words.length : 0;
      const isPureRepetition = hallucinationRatio > 0.7 && totalHallucinationTerms >= 5;

      const uniqueWords = new Set(words).size;
      const uniqueRatio = words.length > 0 ? uniqueWords / words.length : 1;
      const isRepetitive = words.length >= 8 && uniqueRatio < 0.30;

      const phrases = finalText.split(/[,.]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 3);
      let hasPhraseRepetition = false;
      let phraseUniqueRatio = 1;
      if (phrases.length >= 4) {
        const uniquePhrases = new Set(phrases).size;
        phraseUniqueRatio = uniquePhrases / phrases.length;
        if (phraseUniqueRatio < 0.3) {
          console.log(`🚫 [${requestId}] Detected repeated phrase pattern: ${uniquePhrases}/${phrases.length} unique (${(phraseUniqueRatio * 100).toFixed(0)}%)`);
          hasPhraseRepetition = true;
        }
      }

      const severePhraseRepetition = phrases.length >= 6 && phraseUniqueRatio < 0.15;

      if (severePhraseRepetition) {
        const collapsed = collapseRepeatedClauses(finalText);
        const collapsedWordCount = collapsed.text.split(/\s+/).filter(Boolean).length;

        if (collapsed.removed >= 3 && collapsedWordCount >= 6) {
          console.log(`🧹 [${requestId}] Collapsed repeated clauses: removed ${collapsed.removed}, words ${words.length} → ${collapsedWordCount}`);
          finalText = collapsed.text;
          segments = [];
          hallucinationDetected = true;
        } else {
          console.log(`🚫 [${requestId}] Severe repeated phrase pattern detected (${(phraseUniqueRatio * 100).toFixed(0)}% unique)`);
          finalText = '';
          confidence = 0.0;
          no_speech_prob = Math.max(no_speech_prob, 0.95);
          segments = [];
          hallucinationDetected = true;
        }
      } else if ((isPureRepetition || hasPhraseRepetition) && !isContentRich) {
        console.log(`🚫 [${requestId}] Detected repetitive hallucination`);
        finalText = '';
        confidence = 0.0;
        no_speech_prob = Math.max(no_speech_prob, 0.95);
        segments = [];
        hallucinationDetected = true;
      } else if (isRepetitive && !isContentRich) {
        console.log(`🚫 [${requestId}] Detected repetitive content (unique ratio: ${uniqueRatio.toFixed(2)})`);
        finalText = '';
        confidence = 0.0;
        no_speech_prob = Math.max(no_speech_prob, 0.95);
        segments = [];
        hallucinationDetected = true;
      } else if (isContentRich && (isPureRepetition || isRepetitive || hasPhraseRepetition)) {
        console.log(`✅ [${requestId}] Content-rich chunk retained (${words.length} words) with no severe phrase loop`);
      }
    }

    // High no_speech_prob: only reject if text also fails lexical diversity check
    // Confidence alone is NOT a rejection signal — use repetition density instead
    if (no_speech_prob > 0.85 && finalText) {
      const words = finalText.split(/\s+/).filter(Boolean);
      const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
      const uniqueRatio = words.length > 0 ? uniqueWords / words.length : 1;
      const isLexicallyDiverse = uniqueRatio >= 0.25 || words.length >= 120;
      
      if (!isLexicallyDiverse) {
        console.log(`🚫 [${requestId}] Rejecting: high no_speech_prob (${(no_speech_prob * 100).toFixed(1)}%) AND low lexical diversity (${(uniqueRatio * 100).toFixed(0)}%)`);
        finalText = '';
        confidence = 0.0;
        segments = [];
        hallucinationDetected = true;
      } else {
        console.log(`✅ [${requestId}] Retaining chunk despite high no_speech_prob — lexically diverse (${(uniqueRatio * 100).toFixed(0)}% unique, ${words.length} words)`);
      }
    }

    console.log(`📊 [${requestId}] Confidence: ${confidence}${hallucinationDetected ? ' (hallucination filtered)' : ''}`);

    // Ensure segments always exists
    if (segments.length === 0 && finalText) {
      console.log(`⚠️ [${requestId}] No segments from Whisper, creating synthetic segment`);
      segments = [{
        start: 0,
        end: result.duration || 1,
        text: finalText,
        avg_logprob: avg_logprob,
        no_speech_prob: no_speech_prob
      }];
    }

    // ── Apply UK English spelling normalisation ──
    // Final pass: deterministically convert any US spellings Whisper
    // produced despite UK priming in the prompt. Runs on both the merged
    // transcript and every segment so segment.text stays consistent with
    // the top-level text.
    if (finalText) {
      const before = finalText;
      finalText = applyUKSpellings(finalText);
      if (before !== finalText) {
        console.log(`🇬🇧 [${requestId}] Applied UK spelling normalisation to transcript`);
      }
    }
    if (segments.length > 0) {
      segments = segments.map((seg: any) => ({
        ...seg,
        text: applyUKSpellings(seg.text || '')
      }));
    }

    console.log(`📦 [${requestId}] Returning ${segments.length} segments`);

    return new Response(
      JSON.stringify({
        text: finalText,
        confidence,
        avg_logprob,
        no_speech_prob,
        duration: result.duration,
        language: result.language,
        segments,
        hallucination_detected: hallucinationDetected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing request:`, error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to transcribe audio',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
