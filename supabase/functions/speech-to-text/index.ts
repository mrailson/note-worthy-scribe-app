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

    const { audio, mimeType, fileName, language } = await req.json();

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

    // Build language-appropriate prompt
    let whisperPrompt: string;

    if (transcriptionLanguage === 'en') {
      whisperPrompt = `UK GP consultation. NHS primary care.

Clinical terms: SNOMED, NICE guidelines, BNF, QoF, QOF, DES, ICS, PCN, hypertension, hyperlipidaemia, hypothyroidism, diabetes mellitus, type 2 diabetes, ischaemic heart disease, IHD, COPD, chronic obstructive pulmonary disease, asthma, chronic kidney disease, CKD, atrial fibrillation, AF, angina, myocardial infarction, heart failure, osteoarthritis, rheumatoid arthritis, fibromyalgia, depression, anxiety, insomnia.

Medications: metformin, gliclazide, ramipril, lisinopril, amlodipine, atorvastatin, simvastatin, omeprazole, lansoprazole, levothyroxine, bisoprolol, doxazosin, bendroflumethiazide, amoxicillin, flucloxacillin, co-amoxiclav, clarithromycin, doxycycline, prednisolone, salbutamol, Ventolin, Seretide, tiotropium, apixaban, rivaroxaban, warfarin, clopidogrel, aspirin.

Tests: FBC, full blood count, U&Es, urea and electrolytes, LFTs, liver function tests, TFTs, thyroid function tests, HbA1c, eGFR, lipid profile, cholesterol, PSA, urine dipstick, MSU, ECG, electrocardiogram, spirometry, peak flow, blood pressure, BP.

GP systems: SystmOne, EMIS, EMIS Web, eConsult, AccuRx, Docman, TeamNet, Ardens.

UK spellings: haemoglobin, haematology, paediatric, paediatrics, orthopaedic, oedema, coeliac, diarrhoea, anaemia, oesophagus, faeces, colour, favour, organise, practise, centre, litre, metre, behaviour, favour.

Abbreviations: F2F, face to face, T/C, telephone consultation, DNA, did not attend, DNW, FU, follow up, follow-up, Rx, prescription, Hx, history, PMH, past medical history, DH, drug history, SH, social history, FH, family history, O/E, on examination, SOAP, NAD, nothing abnormal detected, TBC, to be confirmed, TCI, to come in, OOH, out of hours, A&E, GP, HCA, healthcare assistant, ANP, advanced nurse practitioner.

Examination terms: auscultation, palpation, percussion, bilateral, unilateral, tenderness, guarding, rebound, crepitations, crackles, wheeze, rhonchi, oedema, erythema, pallor, cyanosis, jaundice, clubbing.`;
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

    // Detect and filter out pure repetitive hallucinations
    if (finalText && finalText.length > 0) {
      const words = finalText.toLowerCase().split(/\s+/).filter(Boolean);
      // Content-rich chunks (≥120 words) bypass repetition rejection — rely on downstream dedup
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
      if (phrases.length >= 4) {
        const uniquePhrases = new Set(phrases).size;
        const phraseUniqueRatio = uniquePhrases / phrases.length;
        if (phraseUniqueRatio < 0.3) {
          console.log(`🚫 [${requestId}] Detected repeated phrase pattern: ${uniquePhrases}/${phrases.length} unique (${(phraseUniqueRatio * 100).toFixed(0)}%)`);
          hasPhraseRepetition = true;
        }
      }

      if ((isPureRepetition || hasPhraseRepetition) && !isContentRich) {
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
        console.log(`✅ [${requestId}] Content-rich chunk retained (${words.length} words) despite repetition signal — downstream dedup will handle`);
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
