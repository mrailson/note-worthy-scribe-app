import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Format detection ────────────────────────────────────────────────────────

function detectFormat(bytes: Uint8Array): { mimeType: string; extension: string } {
  if (bytes.length < 12) return { mimeType: 'audio/webm', extension: 'webm' };

  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return { mimeType: 'audio/webm', extension: 'webm' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return { mimeType: 'audio/wav', extension: 'wav' };
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return { mimeType: 'audio/flac', extension: 'flac' };
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) return { mimeType: 'audio/mpeg', extension: 'mp3' };

  return { mimeType: 'audio/webm', extension: 'webm' };
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }

    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

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

    // Size sanity check: if transcoded output is less than 50% of original,
    // the transcode may have truncated the audio — fall back to original
    if (wasTranscoded && resultBytes.length < audioBytes.length * 0.5 && resultBytes.length < 50000) {
      console.warn(`⚠️ [${requestId}] Transcoded audio suspiciously small (${resultBytes.length}B vs ${audioBytes.length}B original). Falling back to original.`);
      return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
    }

    return { bytes: resultBytes, mimeType: resultMime, extension: resultExt, preprocessed: true };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.warn(`⚠️ [${requestId}] transcode-audio ${isTimeout ? 'timed out' : 'failed'}: ${err?.message || err}, falling back to direct forward`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }
}

// ── Download audio from Supabase Storage ────────────────────────────────────

async function downloadFromStorage(
  bucket: string,
  path: string,
  requestId: string
): Promise<Uint8Array> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, serviceKey);
  
  console.log(`📥 [${requestId}] Downloading from storage: ${bucket}/${path}`);
  
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  if (!data) throw new Error('Storage returned empty data');
  
  const bytes = new Uint8Array(await data.arrayBuffer());
  console.log(`📥 [${requestId}] Downloaded ${bytes.length} bytes from storage`);
  return bytes;
}

// ── Hallucination detection (ported from speech-to-text) ────────────────────

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

function cleanHallucinations(text: string, requestId: string): string {
  if (!text || !text.trim()) return '';

  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const isContentRich = wordCount >= 120;

  // NOTE: We now LOG potential hallucinations but ALWAYS store the transcript.
  // Hallucinated content (repeated words) doesn't materially affect notes generation,
  // and discarding valid audio was causing more harm than keeping borderline content.

  // 1. Check for hallucination phrases — log only
  for (const phrase of HALLUCINATION_PHRASES) {
    if (lowerText.includes(phrase)) {
      console.log(`⚠️ [${requestId}] Possible hallucination phrase detected (stored anyway): "${phrase}"`);
      break;
    }
  }

  // 2. Phone-number / numeric spam detection — log only
  const phonePattern = /\b\d[\d\-]{5,}\d\b/g;
  const phoneMatches = text.match(phonePattern) || [];
  if (phoneMatches.length >= 3) {
    const phoneRatio = phoneMatches.join(' ').split(/\s+/).length / Math.max(wordCount, 1);
    if (phoneRatio > 0.4) {
      console.log(`⚠️ [${requestId}] Possible phone-number hallucination (stored anyway): ${phoneMatches.length} occurrences (ratio ${(phoneRatio * 100).toFixed(0)}%)`);
    }
  }

  // 2b. Repeating numeric/dot pattern detection — log only
  const stripped = text.replace(/\s+/g, '');
  const numericDotChars = (stripped.match(/[\d.]/g) || []).length;
  const numericDotRatio = stripped.length > 0 ? numericDotChars / stripped.length : 0;
  if (stripped.length >= 20 && numericDotRatio > 0.60) {
    console.log(`⚠️ [${requestId}] Possible numeric dot-repeat hallucination (stored anyway): ${(numericDotRatio * 100).toFixed(0)}% numeric/dot chars`);
  }

  // 3. Detect repetitive content — log only
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const uniqueRatio = wordCount > 0 ? uniqueWords / wordCount : 1;
  if (wordCount >= 8 && uniqueRatio < 0.20 && !isContentRich) {
    console.log(`⚠️ [${requestId}] Possible repetitive hallucination (stored anyway): unique ratio ${(uniqueRatio * 100).toFixed(0)}%`);
  }

  // 4. Detect repeated-phrase loops — collapse duplicates but keep content
  const phrases = text.split(/[,.]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 3);
  if (phrases.length >= 4) {
    const uniquePhrases = new Set(phrases).size;
    const phraseUniqueRatio = uniquePhrases / phrases.length;
    if (phraseUniqueRatio < 0.15 && phrases.length >= 6) {
      const collapsed = collapseRepeatedClauses(text);
      if (collapsed.removed >= 3 && collapsed.text.split(/\s+/).length >= 6) {
        console.log(`🧹 [${requestId}] Collapsed ${collapsed.removed} repeated clauses (content preserved)`);
        return collapsed.text;
      }
      console.log(`⚠️ [${requestId}] Severe phrase repetition detected (stored anyway): ${(phraseUniqueRatio * 100).toFixed(0)}% unique`);
    }
    if (phraseUniqueRatio < 0.30 && !isContentRich) {
      console.log(`⚠️ [${requestId}] Phrase-loop pattern detected (stored anyway): ${(phraseUniqueRatio * 100).toFixed(0)}% unique`);
    }
  }

  // Always return the original text — let downstream note generation handle any noise
  return text;
}

function collapseRepeatedClauses(text: string) {
  const clauses = text.split(/(?<=[.!?])\s+|,\s+/).map(p => p.trim()).filter(Boolean);
  if (clauses.length < 4) return { text, removed: 0 };

  const normalise = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const seen = new Set<string>();
  const deduped: string[] = [];
  let removed = 0;

  for (const clause of clauses) {
    const n = normalise(clause);
    if (!n) continue;
    if (seen.has(n)) { removed++; continue; }
    seen.add(n);
    deduped.push(clause);
  }

  return { text: deduped.join(', ').replace(/\s+/g, ' ').trim() || text, removed };
}

// ── Hallucination loop detector ─────────────────────────────────────────────
// Flags any ≥6-word phrase repeating >3 times verbatim and collapses the run
// to a single instance with a [repetition_detected] marker. Operates on
// Whisper segments where present so timestamps stay coherent.
const LOOP_MIN_WORDS = 6;
const LOOP_MAX_REPEATS = 3;
const LOOP_MARKER = ' [repetition_detected]';

function _normaliseForLoop(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function collapseLoopsInSegments(segments: any[]) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { text: '', segments: [] as any[], loopsCollapsed: 0, repeatsRemoved: 0 };
  }
  const out: any[] = [];
  let loopsCollapsed = 0;
  let repeatsRemoved = 0;
  let i = 0;
  while (i < segments.length) {
    const cur = segments[i];
    const curNorm = _normaliseForLoop(cur.text || '');
    const wordCount = curNorm ? curNorm.split(' ').length : 0;
    if (wordCount >= LOOP_MIN_WORDS) {
      let j = i + 1;
      while (j < segments.length && _normaliseForLoop(segments[j].text || '') === curNorm) j++;
      const runLength = j - i;
      if (runLength > LOOP_MAX_REPEATS) {
        out.push({ ...cur, end: segments[j - 1].end ?? cur.end, text: (cur.text || '').trim() + LOOP_MARKER });
        loopsCollapsed += 1;
        repeatsRemoved += runLength - 1;
        i = j;
        continue;
      }
    }
    out.push(cur);
    i++;
  }
  const text = out.map(s => (s.text || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { text, segments: out, loopsCollapsed, repeatsRemoved };
}

function collapseLoopsInText(text: string) {
  if (!text || !text.trim()) return { text: '', segments: [] as any[], loopsCollapsed: 0, repeatsRemoved: 0 };
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const fauxSegments = sentences.map(s => ({ text: s }));
  const res = collapseLoopsInSegments(fauxSegments);
  return { ...res, text: res.text || text };
}

// ── Main handler ────────────────────────────────────────────────────────────

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
    if (match === match.toUpperCase()) return replacement.toUpperCase();
    if (match[0] === match[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

// Default British NHS fallback prompt — used when the caller does not
// supply its own prompt. Mirrors the fallback used in speech-to-text.
const DEFAULT_FALLBACK_PROMPT =
  'British English NHS primary care meeting transcript. ' +
  'Use UK spellings: judgement, organisation, recognise, programme, behaviour. ' +
  'Common terms: PCN, ICB, CQC, GP, ANP, ACP, ARRS, GMS, MoU, DPIA, ' +
  'neighbourhood, workstream, safeguarding, dispensing, enhanced access, ' +
  'social prescribing.';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OpenAI API key not configured');

    const body = await req.json();
    const {
      audio,
      storagePath,
      bucket,
      responseFormat,
      prompt: whisperPrompt,
      meetingId = null,
      sessionId = null,
      chunkIndex = null,
      includeDiagnostics = false,
    } = body;

    const validFormats = ['json', 'verbose_json', 'text', 'srt', 'vtt'];
    const resolvedFormat = validFormats.includes(responseFormat) ? responseFormat : 'json';

    if (!audio && !storagePath) throw new Error('No audio data or storagePath provided');

    let binaryAudio: Uint8Array;

    if (storagePath) {
      binaryAudio = await downloadFromStorage(bucket || 'recordings', storagePath, requestId);
    } else {
      console.log(`📋 [${requestId}] Processing audio chunk, base64 size: ${audio.length}`);
      binaryAudio = processBase64Chunks(audio);
    }

    console.log(`📦 [${requestId}] Binary audio: ${binaryAudio.length} bytes`);

    if (binaryAudio.length > 25 * 1024 * 1024) {
      throw new Error(`Audio file too large (${Math.round(binaryAudio.length / (1024 * 1024))}MB). Whisper limit is 25MB.`);
    }

    const format = detectFormat(binaryAudio);
    const numericChunkIndex = typeof chunkIndex === 'number' ? chunkIndex : Number(chunkIndex);
    const firstChunkLikely = Number.isFinite(numericChunkIndex) && numericChunkIndex === 0;
    const headerPreviewHex = Array.from(binaryAudio.slice(0, 16))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
    const webmInitSegmentValid = format.extension !== 'webm'
      ? true
      : binaryAudio.length >= 4 && binaryAudio[0] === 0x1A && binaryAudio[1] === 0x45 && binaryAudio[2] === 0xDF && binaryAudio[3] === 0xA3;

    const diagnostics: Record<string, unknown> = {
      requestId,
      meetingId,
      sessionId,
      chunkIndex: Number.isFinite(numericChunkIndex) ? numericChunkIndex : chunkIndex,
      storagePath: storagePath || null,
      bucket: bucket || null,
      firstChunkLikely,
      originalBytes: binaryAudio.length,
      detectedMimeType: format.mimeType,
      detectedExtension: format.extension,
      headerPreviewHex,
      webmInitSegmentValid,
      preprocessed: false,
      preprocessedBytes: null,
      forwardMimeType: null,
      forwardExtension: null,
    };

    if (firstChunkLikely && format.extension === 'webm' && !webmInitSegmentValid) {
      console.warn(`⚠️ [${requestId}] First chunk appears to have an invalid WebM init segment`, diagnostics);
    }

    console.log(`🎵 [${requestId}] Detected format: ${format.mimeType} (.${format.extension})`);

    const preprocessed = await preprocessAudioViaTranscode(binaryAudio, format.mimeType, requestId);

    const forwardMime = preprocessed.preprocessed ? preprocessed.mimeType : format.mimeType;
    const forwardExt = preprocessed.preprocessed ? preprocessed.extension : format.extension;

    diagnostics.preprocessed = preprocessed.preprocessed;
    diagnostics.preprocessedBytes = preprocessed.bytes.length;
    diagnostics.forwardMimeType = forwardMime;
    diagnostics.forwardExtension = forwardExt;

    console.log(`📡 [${requestId}] Forwarding to OpenAI: ${preprocessed.bytes.length}B as ${forwardMime} (.${forwardExt}), preprocessed=${preprocessed.preprocessed}, format=${resolvedFormat}`);

    const requestedModel = body.model || 'whisper-1';
    const model = resolvedFormat === 'verbose_json' ? 'whisper-1' : requestedModel;
    const temperature = body.temperature ?? '0';

    const formData = new FormData();
    const blob = new Blob([preprocessed.bytes], { type: forwardMime });
    formData.append('file', blob, `audio.${forwardExt}`);
    formData.append('model', model);
    formData.append('language', 'en');
    formData.append('response_format', resolvedFormat);
    formData.append('temperature', String(temperature));
    // Anti-hallucination decode params (recommended Whisper config).
    // condition_on_previous_text=false stops looped output being re-fed into the decoder,
    // which is the primary trigger for "phrase repeats N times verbatim" failures.
    formData.append('condition_on_previous_text', 'false');
    formData.append('compression_ratio_threshold', '2.4');
    formData.append('no_speech_threshold', '0.6');
    formData.append('logprob_threshold', '-1.0');

    // Use caller-supplied prompt if non-empty, otherwise fall back to the
    // British NHS default. Same pattern as speech-to-text — guarantees that
    // every offline transcription benefits from UK English priming, even
    // when the caller forgot to supply context.
    const effectivePrompt = (typeof whisperPrompt === 'string' && whisperPrompt.trim().length > 0)
      ? whisperPrompt
      : DEFAULT_FALLBACK_PROMPT;
    formData.append('prompt', effectivePrompt);

    console.log(`🤖 [${requestId}] Using model=${model}, format=${resolvedFormat}, temperature=${temperature}, condition_on_previous_text=false, compression_ratio_threshold=2.4, no_speech_threshold=0.6, prompt=${whisperPrompt ? 'yes (' + whisperPrompt.length + ' chars)' : 'none'}`);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: formData,
    });

    if (response.ok) {
      if (resolvedFormat === 'text' || resolvedFormat === 'srt' || resolvedFormat === 'vtt') {
        const textResult = await response.text();
        let cleanedText = cleanHallucinations(textResult, requestId);
        let loopsCollapsed = 0;
        let repeatsRemoved = 0;
        if (resolvedFormat === 'text' && cleanedText) {
          const collapsed = collapseLoopsInText(cleanedText);
          if (collapsed.loopsCollapsed > 0) {
            console.warn(`🔁 [${requestId}] Loop detector (text): collapsed ${collapsed.loopsCollapsed} loop(s), removed ${collapsed.repeatsRemoved} repeats`);
            cleanedText = collapsed.text;
            loopsCollapsed = collapsed.loopsCollapsed;
            repeatsRemoved = collapsed.repeatsRemoved;
          }
        }
        // ── Apply UK spelling normalisation (text/srt/vtt) ──
        if (resolvedFormat === 'text' && cleanedText) {
          const before = cleanedText;
          cleanedText = applyUKSpellings(cleanedText);
          if (before !== cleanedText) {
            console.log(`🇬🇧 [${requestId}] Applied UK spelling normalisation (text)`);
          }
        }
        console.log(`✅ [${requestId}] Whisper ${resolvedFormat} result: ${cleanedText.slice(0, 100)}…`);
        return new Response(
          JSON.stringify({
            text: cleanedText,
            service: 'whisper',
            format: forwardMime,
            loopsCollapsed,
            repeatsRemoved,
            ...(includeDiagnostics ? { diagnostics } : {}),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      let finalText = result.text || '';
      let segments = result.segments || [];

      const cleaned = cleanHallucinations(finalText, requestId);
      if (cleaned !== finalText) {
        finalText = cleaned;
        segments = [];
      }

      // ── Loop detector: collapse ≥6-word phrases repeated >3 times ──
      let loopsCollapsed = 0;
      let repeatsRemoved = 0;
      if (finalText) {
        if (Array.isArray(segments) && segments.length > 0) {
          const collapsed = collapseLoopsInSegments(segments);
          if (collapsed.loopsCollapsed > 0) {
            console.warn(`🔁 [${requestId}] Loop detector: collapsed ${collapsed.loopsCollapsed} loop(s), removed ${collapsed.repeatsRemoved} repeated segment(s)`);
            segments = collapsed.segments;
            finalText = collapsed.text;
            loopsCollapsed = collapsed.loopsCollapsed;
            repeatsRemoved = collapsed.repeatsRemoved;
          }
        } else {
          const collapsed = collapseLoopsInText(finalText);
          if (collapsed.loopsCollapsed > 0) {
            console.warn(`🔁 [${requestId}] Loop detector (text): collapsed ${collapsed.loopsCollapsed} loop(s), removed ${collapsed.repeatsRemoved} repeats`);
            finalText = collapsed.text;
            loopsCollapsed = collapsed.loopsCollapsed;
            repeatsRemoved = collapsed.repeatsRemoved;
          }
        }
      }

      // ── Apply UK spelling normalisation (JSON / verbose_json) ──
      // Final pass: deterministically convert any US spellings Whisper
      // produced despite UK priming. Runs on both top-level text and every
      // segment so segment.text stays consistent with the merged text.
      if (finalText) {
        const before = finalText;
        finalText = applyUKSpellings(finalText);
        if (before !== finalText) {
          console.log(`🇬🇧 [${requestId}] Applied UK spelling normalisation`);
        }
      }
      if (Array.isArray(segments) && segments.length > 0) {
        segments = segments.map((seg: any) => ({
          ...seg,
          text: applyUKSpellings(seg.text || '')
        }));
      }

      if (!finalText && firstChunkLikely) {
        console.warn(`⚠️ [${requestId}] First chunk returned empty transcript from OpenAI`, {
          ...diagnostics,
          openaiDuration: result.duration || 0,
          openaiLanguage: result.language || 'en',
          openaiSegmentCount: Array.isArray(result.segments) ? result.segments.length : 0,
        });
      }

      console.log(`✅ [${requestId}] Whisper result: ${finalText.slice(0, 100)}…`);

      const responseBody: Record<string, any> = {
        text: finalText,
        service: 'whisper',
        format: forwardMime,
        loopsCollapsed,
        repeatsRemoved,
      };

      if (resolvedFormat === 'verbose_json') {
        responseBody.segments = segments;
        responseBody.language = result.language || 'en';
        responseBody.duration = result.duration || 0;
      }

      if (includeDiagnostics || (!finalText && firstChunkLikely)) {
        responseBody.diagnostics = {
          ...diagnostics,
          openaiDuration: result.duration || 0,
          openaiLanguage: result.language || 'en',
          openaiSegmentCount: Array.isArray(result.segments) ? result.segments.length : 0,
          loopsCollapsed,
          repeatsRemoved,
        };
      }

      return new Response(
        JSON.stringify(responseBody),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorText = await response.text();
    console.error(`❌ [${requestId}] OpenAI API error (${response.status}): ${errorText}`);
    return new Response(
      JSON.stringify({
        error: `OpenAI API error (${response.status}): ${errorText}`,
        service: 'whisper',
        diagnostics,
        openaiStatus: response.status,
        openaiErrorBody: errorText,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Standalone Whisper error:`, error);

    return new Response(
      JSON.stringify({
        error: error.message,
        service: 'whisper'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
