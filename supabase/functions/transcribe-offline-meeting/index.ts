import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);
const OFFLINE_WHISPER_SOURCE = "offline_whisper_batch";
const STALE_PROCESSING_MINUTES = 15;

interface ChunkSource {
  chunkNumber: number;
  storagePath: string;
  bucket: string;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
  fileSize?: number | null;
}

interface ChunkRow {
  id?: string;
  chunk_number: number;
  transcription_text: string;
  start_time?: number | null;
  end_time?: number | null;
  created_at?: string;
  word_count?: number | null;
  validation_status?: string | null;
}

interface WhisperChunkResult {
  text: string;
  segments: unknown[];
  duration: number;
  language: string;
  diagnostics?: Record<string, unknown> | null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function minutesSince(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ms) / 60000;
}

function toRelativeSeconds(absoluteIso?: string | null, meetingStartIso?: string | null): number | undefined {
  if (!absoluteIso || !meetingStartIso) return undefined;
  const absoluteMs = new Date(absoluteIso).getTime();
  const startMs = new Date(meetingStartIso).getTime();
  if (!Number.isFinite(absoluteMs) || !Number.isFinite(startMs)) return undefined;
  return Math.max(0, (absoluteMs - startMs) / 1000);
}

function buildSyntheticTiming(chunkNumber: number, durationSec: number) {
  const safeDuration = durationSec > 0 ? durationSec : 900;
  const startSec = chunkNumber * safeDuration;
  return { startSec, endSec: startSec + safeDuration, durationSec: safeDuration };
}

function normaliseWhitespace(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function removeOverlapText(currentTranscript: string, previousTranscript: string): string {
  if (!currentTranscript || !previousTranscript) return currentTranscript;

  const currentWords = currentTranscript.split(/\s+/).filter(Boolean);
  const previousWords = previousTranscript.split(/\s+/).filter(Boolean);
  const previousTail = previousWords.slice(-80).map((word) => word.toLowerCase());
  const previousTailStr = previousTail.join(" ");
  const searchWindow = Math.min(50, currentWords.length);

  let overlapEndIndex = 0;

  for (let phraseLength = Math.min(30, searchWindow); phraseLength >= 8; phraseLength--) {
    for (let startIndex = 0; startIndex <= searchWindow - phraseLength; startIndex++) {
      const phrase = currentWords
        .slice(startIndex, startIndex + phraseLength)
        .map((word) => word.toLowerCase())
        .join(" ");

      if (previousTailStr.includes(phrase)) {
        overlapEndIndex = startIndex + phraseLength;
        break;
      }
    }

    if (overlapEndIndex > 0) break;
  }

  return overlapEndIndex > 0
    ? currentWords.slice(overlapEndIndex).join(" ")
    : currentTranscript;
}

function dedupeChunkRows(chunks: ChunkRow[]): ChunkRow[] {
  const sorted = [...chunks].sort((a, b) => {
    if (a.chunk_number !== b.chunk_number) return a.chunk_number - b.chunk_number;
    const aStart = safeNumber(a.start_time) ?? Number.MAX_SAFE_INTEGER;
    const bStart = safeNumber(b.start_time) ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const seen = new Set<string>();
  const deduped: ChunkRow[] = [];

  for (const chunk of sorted) {
    const startKey = safeNumber(chunk.start_time);
    const endKey = safeNumber(chunk.end_time);
    const text = normaliseWhitespace(chunk.transcription_text || "");
    const key = [
      chunk.chunk_number,
      startKey ?? "na",
      endKey ?? "na",
      text.slice(0, 500),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...chunk, transcription_text: text });
  }

  return deduped.sort((a, b) => {
    if (a.chunk_number !== b.chunk_number) return a.chunk_number - b.chunk_number;
    const aStart = safeNumber(a.start_time) ?? a.chunk_number * 900;
    const bStart = safeNumber(b.start_time) ?? b.chunk_number * 900;
    return aStart - bStart;
  });
}

function stitchChunkTexts(chunks: ChunkRow[]): string {
  const ordered = dedupeChunkRows(chunks)
    .filter((chunk) => normaliseWhitespace(chunk?.transcription_text).length > 0);

  if (ordered.length === 0) return "";

  const stitched = [ordered[0].transcription_text.trim()];

  for (let i = 1; i < ordered.length; i++) {
    const deduplicated = removeOverlapText(
      ordered[i].transcription_text,
      stitched[stitched.length - 1],
    ).trim();

    if (deduplicated) stitched.push(deduplicated);
  }

  return stitched.join(" ").replace(/\s+/g, " ").trim();
}

async function getChunkSources(meetingId: string, meetingStartIso?: string | null, meetingDurationMinutes?: number | null, chunkCount?: number | null): Promise<ChunkSource[]> {
  const { data: audioChunks, error: chunkError } = await supabase
    .from("audio_chunks")
    .select("chunk_number, audio_blob_path, start_time, end_time, chunk_duration_ms, file_size")
    .eq("meeting_id", meetingId)
    .not("audio_blob_path", "is", null)
    .order("chunk_number", { ascending: true });

  if (chunkError) {
    console.warn("Failed to read audio_chunks metadata:", chunkError);
  }

  if (audioChunks && audioChunks.length > 0) {
    console.log(`📦 Found ${audioChunks.length} chunks via audio_chunks table`);
    return audioChunks.map((chunk) => {
      const fallback = buildSyntheticTiming(
        chunk.chunk_number,
        Math.max(1, Math.round((safeNumber(chunk.chunk_duration_ms) ?? 900000) / 1000)),
      );
      return {
        chunkNumber: chunk.chunk_number,
        storagePath: chunk.audio_blob_path as string,
        bucket: "recordings",
        startSec: toRelativeSeconds(chunk.start_time, meetingStartIso) ?? fallback.startSec,
        endSec: toRelativeSeconds(chunk.end_time, meetingStartIso) ?? fallback.endSec,
        durationSec: safeNumber(chunk.chunk_duration_ms) != null ? (safeNumber(chunk.chunk_duration_ms)! / 1000) : fallback.durationSec,
        fileSize: safeNumber(chunk.file_size),
      };
    });
  }

  const { data: meetingRow, error: meetingErr } = await supabase
    .from("meetings")
    .select("remote_chunk_paths")
    .eq("id", meetingId)
    .single();

  if (meetingErr) {
    console.warn("Failed to read meeting remote_chunk_paths:", meetingErr);
  }

  const syntheticChunkDuration = (() => {
    const count = chunkCount || meetingRow?.remote_chunk_paths?.length || 1;
    const totalSec = Math.max(1, Math.round((meetingDurationMinutes || 0) * 60));
    return Math.max(1, Math.round(totalSec / count));
  })();

  if (meetingRow?.remote_chunk_paths && Array.isArray(meetingRow.remote_chunk_paths) && meetingRow.remote_chunk_paths.length > 0) {
    console.log(`📱 Found ${meetingRow.remote_chunk_paths.length} chunks via remote_chunk_paths`);
    return meetingRow.remote_chunk_paths.map((path: string, index: number) => {
      const timing = buildSyntheticTiming(index, syntheticChunkDuration);
      return {
        chunkNumber: index,
        storagePath: path,
        bucket: "recordings",
        startSec: timing.startSec,
        endSec: timing.endSec,
        durationSec: timing.durationSec,
      };
    });
  }

  const { data: backups, error: backupError } = await supabase
    .from("meeting_audio_backups")
    .select("file_path")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (backupError) {
    console.warn("Failed to read meeting_audio_backups metadata:", backupError);
  }

  if (backups && backups.length > 0) {
    console.log(`💾 Found ${backups.length} chunks via meeting_audio_backups`);
    return backups.map((backup, index) => {
      const timing = buildSyntheticTiming(index, syntheticChunkDuration);
      return {
        chunkNumber: index,
        storagePath: backup.file_path,
        bucket: "meeting-audio-backups",
        startSec: timing.startSec,
        endSec: timing.endSec,
        durationSec: timing.durationSec,
      };
    });
  }

  const { data: files, error: listErr } = await supabase.storage
    .from("recordings")
    .list(meetingId, { sortBy: { column: "name", order: "asc" } });

  if (listErr) {
    throw new Error(`Storage list failed: ${listErr.message}`);
  }

  if (files && files.length > 0) {
    console.log(`📂 Found ${files.length} files via bucket listing recordings/${meetingId}/`);
  }

  return (files || []).map((file, index) => {
    const timing = buildSyntheticTiming(index, syntheticChunkDuration);
    return {
      chunkNumber: index,
      storagePath: `${meetingId}/${file.name}`,
      bucket: "recordings",
      startSec: timing.startSec,
      endSec: timing.endSec,
      durationSec: timing.durationSec,
      fileSize: safeNumber((file as { metadata?: { size?: number } }).metadata?.size),
    };
  });
}

async function transcribeStoragePath(storagePath: string, bucket: string, prompt: string, meetingId: string, sessionId: string, chunkIndex: number): Promise<WhisperChunkResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/standalone-whisper`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storagePath,
      bucket,
      responseFormat: "verbose_json",
      prompt,
      meetingId,
      sessionId,
      chunkIndex,
      includeDiagnostics: chunkIndex <= 1,
    }),
  });

  const bodyText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    payload = { raw: bodyText };
  }

  if (!response.ok) {
    throw new Error(bodyText || `Transcription failed for ${storagePath}`);
  }

  return {
    text: normaliseWhitespace(String(payload?.text || "")),
    segments: Array.isArray(payload?.segments) ? payload.segments as unknown[] : [],
    duration: safeNumber(payload?.duration) ?? 0,
    language: String(payload?.language || "en"),
    diagnostics: (payload?.diagnostics as Record<string, unknown> | undefined) || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, chunkIndex = 0 } = await req.json();
    if (!meetingId) throw new Error("meetingId required");

    const numericChunkIndex = Number(chunkIndex);
    if (!Number.isInteger(numericChunkIndex) || numericChunkIndex < 0) {
      throw new Error("chunkIndex must be a non-negative integer");
    }

    console.log(`🎙️ Transcribing offline meeting: ${meetingId}, chunk ${numericChunkIndex}`);

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, user_id, title, start_time, duration_minutes, chunk_count")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) throw new Error("Meeting not found");

    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const isInternalCall = !bearerToken || bearerToken === serviceKey || bearerToken === anonKey;

    if (!isInternalCall) {
      const { data: { user: callerUser }, error: authErr } = await supabase.auth.getUser(bearerToken);
      if (authErr || !callerUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (callerUser.id !== meeting.user_id) {
        return new Response(JSON.stringify({ error: "Forbidden: you do not own this meeting" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const chunkSources = await getChunkSources(meetingId, meeting.start_time, meeting.duration_minutes, meeting.chunk_count);
    if (!chunkSources.length) throw new Error("No audio files found for this meeting");
    if (numericChunkIndex >= chunkSources.length) {
      throw new Error(`Chunk ${numericChunkIndex} is out of range for ${chunkSources.length} chunks`);
    }

    const totalChunks = chunkSources.length;
    const sessionId = `offline-retranscribe-${meetingId}`;

    // ============ Concurrent-invocation guard (chunk 0) ============
    // Mobile clients sometimes fire this endpoint 2–3× in quick succession
    // (network retry / async upload race). Without a lock the duplicate
    // invocations DELETE each other's chunk rows and race on Whisper, then
    // one sibling fails "Stitched empty" and flips the meeting to FAILED.
    // We use the meetings row as a soft lock: if another worker took the
    // lock within the last 60s, we bail with 200 — never an error.
    if (numericChunkIndex === 0) {
      const { data: lockRow } = await supabase
        .from("meetings")
        .select("notes_generation_status, updated_at")
        .eq("id", meetingId)
        .maybeSingle();

      const ageSec = lockRow?.updated_at
        ? (Date.now() - new Date(lockRow.updated_at).getTime()) / 1000
        : Number.POSITIVE_INFINITY;
      const inFlight = lockRow?.notes_generation_status === "transcribing" && ageSec < 60;

      if (inFlight) {
        console.log(`🔒 Another worker is already transcribing meeting ${meetingId} (age=${ageSec.toFixed(1)}s) — skipping duplicate invocation`);
        return new Response(JSON.stringify({
          success: true,
          status: "already_in_flight",
          meetingId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("meetings").update({
        notes_generation_status: "transcribing",
      }).eq("id", meetingId);

      // Only wipe chunk rows if NONE are currently mid-process or completed
      // with content (avoids destroying a sibling worker's good output).
      const { data: existingRows } = await supabase
        .from("meeting_transcription_chunks")
        .select("id, validation_status, word_count, created_at")
        .eq("meeting_id", meetingId)
        .eq("session_id", sessionId)
        .eq("transcriber_type", "whisper");

      const hasLiveWork = (existingRows || []).some((r) => {
        const isProcessingFresh = r.validation_status === "processing" &&
          (Date.now() - new Date(r.created_at).getTime()) / 1000 < STALE_PROCESSING_MINUTES * 60;
        const hasContent = (r.word_count || 0) > 0 && r.validation_status === "validated";
        return isProcessingFresh || hasContent;
      });

      if (!hasLiveWork) {
        await supabase.from("meeting_transcription_chunks")
          .delete()
          .eq("meeting_id", meetingId)
          .eq("session_id", sessionId)
          .eq("transcriber_type", "whisper");
      } else {
        console.log(`♻️ Preserving ${existingRows?.length || 0} existing chunk rows for ${meetingId} (live work detected)`);
      }
    }

    const source = chunkSources[numericChunkIndex];
    const safeTitle = (meeting.title || "")
      .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "")
      .replace(/\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/gi, "")
      .replace(/\d{4}/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    // Strong UK NHS prompt — same content profile as speech-to-text. The
    // meeting title (where present) is placed at the END of the prompt
    // because Whisper conditions most heavily on the final ~224 tokens of
    // the prompt window.
    const prompt = [
      'British English NHS primary care meeting transcript. ' +
      'Use UK spellings: judgement, organisation, recognise, programme, behaviour, neighbourhood, centre. ' +
      'Common terms: PCN, ICB, CQC, EMIS, SystmOne, GP, ANP, ACP, ARRS, GMS, DES, LES, ' +
      'MoU, DPIA, DTAC, NRES, neighbourhood team, workstream, safeguarding, dispensing, ' +
      'enhanced access, social prescribing, clinical pharmacist.',
      safeTitle ? `Meeting: ${safeTitle}.` : null,
    ].filter(Boolean).join(' ');

    const placeholderPayload = {
      meeting_id: meetingId,
      chunk_number: source.chunkNumber,
      transcription_text: "",
      user_id: meeting.user_id,
      session_id: sessionId,
      is_final: false,
      transcriber_type: "whisper",
      // NOTE: `source` is a generated column (mirrors transcriber_type) — never insert directly
      word_count: 0,
      validation_status: "processing",
      merge_rejection_reason: null,
      start_time: source.startSec ?? null,
      end_time: source.endSec ?? null,
      segments_json: {
        storagePath: source.storagePath,
        bucket: source.bucket,
        durationSec: source.durationSec ?? null,
        fileSize: source.fileSize ?? null,
      },
    };

    let chunkRowId: string | null = null;
    let shouldTranscribe = true;

    const { data: insertedRow, error: insertPlaceholderErr } = await supabase
      .from("meeting_transcription_chunks")
      .insert(placeholderPayload)
      .select("id")
      .single();

    if (insertPlaceholderErr) {
      const isDuplicate = insertPlaceholderErr.code === "23505" || /duplicate/i.test(insertPlaceholderErr.message || "");
      if (!isDuplicate) {
        throw new Error(`Chunk placeholder insert failed: ${insertPlaceholderErr.message}`);
      }

      const { data: existingRow, error: existingErr } = await supabase
        .from("meeting_transcription_chunks")
        .select("id, is_final, validation_status, word_count, created_at")
        .eq("meeting_id", meetingId)
        .eq("session_id", sessionId)
        .eq("chunk_number", source.chunkNumber)
        .eq("transcriber_type", "whisper")
        .maybeSingle();

      if (existingErr || !existingRow) {
        throw new Error(`Could not read existing chunk state: ${existingErr?.message || "missing existing row"}`);
      }

      chunkRowId = existingRow.id;

      if (existingRow.is_final && (existingRow.word_count || 0) > 0) {
        shouldTranscribe = false;
        console.log(`⏭️ Chunk ${source.chunkNumber} already completed, skipping transcription`);
      } else if (existingRow.validation_status === "processing" && minutesSince(existingRow.created_at) < STALE_PROCESSING_MINUTES) {
        console.log(`⏸️ Chunk ${source.chunkNumber} is already being processed elsewhere, stopping duplicate run`);
        return new Response(JSON.stringify({
          success: true,
          status: "already_processing",
          chunk: numericChunkIndex,
          totalChunks,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { error: takeOverErr } = await supabase
          .from("meeting_transcription_chunks")
          .update({
            validation_status: "processing",
            is_final: false,
            merge_rejection_reason: null,
            transcription_text: "",
            word_count: 0,
            start_time: source.startSec ?? null,
            end_time: source.endSec ?? null,
            segments_json: {
              storagePath: source.storagePath,
              bucket: source.bucket,
              durationSec: source.durationSec ?? null,
              fileSize: source.fileSize ?? null,
            },
          })
          .eq("id", existingRow.id);

        if (takeOverErr) {
          throw new Error(`Could not take over stale chunk row: ${takeOverErr.message}`);
        }
      }
    } else {
      chunkRowId = insertedRow.id;
    }

    if (shouldTranscribe) {
      let chunkResult: WhisperChunkResult;
      try {
        chunkResult = await transcribeStoragePath(
          source.storagePath,
          source.bucket,
          prompt,
          meetingId,
          sessionId,
          source.chunkNumber,
        );
      } catch (transcribeErr) {
        await supabase.from("meeting_transcription_chunks")
          .update({
            validation_status: "failed",
            is_final: true,
            merge_rejection_reason: transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr),
          })
          .eq("id", chunkRowId!);

        await supabase.from("meetings").update({
          notes_generation_status: "failed",
        }).eq("id", meetingId);

        throw transcribeErr;
      }

      const chunkText = normaliseWhitespace(chunkResult.text || "");
      const wordCount = chunkText ? chunkText.split(/\s+/).filter(Boolean).length : 0;
      const validationStatus = chunkText ? "validated" : "failed";
      const mergeRejectionReason = chunkText ? null : "Empty transcript returned by standalone-whisper";

      if (!chunkText) {
        console.warn(`⚠️ Chunk ${source.chunkNumber} returned empty transcript`, {
          meetingId,
          storagePath: source.storagePath,
          diagnostics: chunkResult.diagnostics,
        });
      }

      const { error: updateChunkErr } = await supabase
        .from("meeting_transcription_chunks")
        .update({
          transcription_text: chunkText,
          is_final: true,
          validation_status: validationStatus,
          merge_rejection_reason: mergeRejectionReason,
          word_count: wordCount,
          start_time: source.startSec ?? null,
          end_time: source.endSec ?? null,
          segments_json: {
            storagePath: source.storagePath,
            bucket: source.bucket,
            durationSec: source.durationSec ?? null,
            fileSize: source.fileSize ?? null,
            language: chunkResult.language,
            whisperDuration: chunkResult.duration,
            diagnostics: chunkResult.diagnostics || null,
            segmentCount: chunkResult.segments.length,
          },
        })
        .eq("id", chunkRowId!);

      if (updateChunkErr) {
        throw new Error(`Chunk update failed: ${updateChunkErr.message}`);
      }

      console.log(`✅ Chunk ${source.chunkNumber} saved (${wordCount} words)`);

      // ============ Fire-and-forget Deepgram batch transcription ============
      // Runs alongside Whisper so Best-of-All has a second engine on the mobile
      // path. MUST NEVER block Whisper write or downstream notes generation.
      (async () => {
        const dgStart = Date.now();
        try {
          const dgResp = await fetch(`${supabaseUrl}/functions/v1/standalone-deepgram`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              apikey: serviceKey,
            },
            body: JSON.stringify({ storagePath: source.storagePath, bucket: source.bucket }),
          });
          const dgElapsed = Date.now() - dgStart;
          if (!dgResp.ok) {
            const errText = await dgResp.text().catch(() => "");
            console.warn(`[DG-Mobile] meeting=${meetingId} chunk=${source.chunkNumber} duration=${source.durationSec ?? "n/a"}s response_ms=${dgElapsed} status=${dgResp.status} FAILED: ${errText.slice(0, 200)}`);
            return;
          }
          const dgJson = await dgResp.json();
          const dgText = (dgJson?.text || "").trim();
          const dgWordCount = dgText ? dgText.split(/\s+/).filter(Boolean).length : 0;

          console.log(`[DG-Mobile] meeting=${meetingId} chunk=${source.chunkNumber} duration=${source.durationSec ?? "n/a"}s response_ms=${dgElapsed} words=${dgWordCount}`);

          if (!dgText) return;

          await supabase.from("deepgram_transcriptions").insert({
            meeting_id: meetingId,
            user_id: meeting.user_id,
            session_id: sessionId,
            chunk_number: source.chunkNumber,
            transcription_text: dgText,
            confidence: typeof dgJson?.confidence === "number" ? dgJson.confidence : null,
            is_final: true,
            word_count: dgWordCount,
          });
        } catch (dgErr) {
          const dgElapsed = Date.now() - dgStart;
          console.warn(`[DG-Mobile] meeting=${meetingId} chunk=${source.chunkNumber} duration=${source.durationSec ?? "n/a"}s response_ms=${dgElapsed} EXCEPTION: ${dgErr instanceof Error ? dgErr.message : String(dgErr)}`);
        }
      })();
    }

    const nextChunk = numericChunkIndex + 1;
    if (nextChunk < totalChunks) {
      const chainResp = await fetch(`${supabaseUrl}/functions/v1/transcribe-offline-meeting`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({ meetingId, chunkIndex: nextChunk }),
      });

      if (!chainResp.ok) {
        const errText = await chainResp.text();
        console.error(`❌ Chain call failed: ${chainResp.status} ${errText}`);
      } else {
        await chainResp.text();
      }

      return new Response(JSON.stringify({
        success: true,
        status: "processing",
        chunk: numericChunkIndex,
        totalChunks,
        message: `Chunk ${numericChunkIndex} done, processing ${nextChunk} next`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allChunks, error: fetchErr } = await supabase
      .from("meeting_transcription_chunks")
      .select("chunk_number, transcription_text, start_time, end_time, created_at, word_count, validation_status")
      .eq("meeting_id", meetingId)
      .eq("session_id", sessionId)
      .eq("transcriber_type", "whisper")
      .order("chunk_number", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchErr) throw new Error(`Failed to fetch chunks: ${fetchErr.message}`);

    let stitchedChunks = dedupeChunkRows((allChunks || []) as ChunkRow[]);
    let fullTranscript = stitchChunkTexts(stitchedChunks);
    let wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;

    if (!fullTranscript || wordCount === 0) {
      // Could be a sibling-invocation race — retry once after a brief pause
      // before declaring the meeting failed. A mobile user cannot re-record.
      console.warn(`⚠️ Stitched transcript empty on first read for ${meetingId} — retrying after 3s in case of sibling write delay`);
      await new Promise((r) => setTimeout(r, 3000));
      const { data: retryChunks } = await supabase
        .from("meeting_transcription_chunks")
        .select("chunk_number, transcription_text, start_time, end_time, created_at, word_count, validation_status")
        .eq("meeting_id", meetingId)
        .eq("session_id", sessionId)
        .eq("transcriber_type", "whisper")
        .order("chunk_number", { ascending: true })
        .order("created_at", { ascending: false });
      stitchedChunks = dedupeChunkRows((retryChunks || []) as ChunkRow[]);
      fullTranscript = stitchChunkTexts(stitchedChunks);
      wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;
      if (fullTranscript && wordCount > 0) {
        console.log(`✅ Retry recovered ${wordCount} words for ${meetingId}`);
      } else {
        // Genuine empty — likely sibling concurrent run already finalised. Bail
        // softly instead of throwing (which would mark the meeting as failed).
        console.warn(`⚠️ Stitched still empty for ${meetingId} after retry — assuming sibling worker handled it`);
        return new Response(JSON.stringify({
          success: true,
          status: "empty_after_retry_assumed_sibling",
          meetingId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (wordCount < 100) {
      await supabase.from("meetings").update({
        whisper_transcript_text: fullTranscript,
        primary_transcript_source: "whisper",
        word_count: wordCount,
        notes_generation_status: "failed",
        overview: "Recording was too short to generate meeting notes — less than 100 words transcribed.",
      }).eq("id", meetingId);

      console.log(`⚠️ Meeting ${meetingId} too short (${wordCount} words), skipping note generation`);
      return new Response(JSON.stringify({
        success: true,
        status: "too_short",
        wordCount,
        stitchedChunkCount: stitchedChunks.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabase
      .from("meetings")
      .update({
        whisper_transcript_text: fullTranscript,
        primary_transcript_source: "whisper",
        word_count: wordCount,
        notes_generation_status: "queued",
        status: "completed",
      })
      .eq("id", meetingId);

    if (updateErr) throw new Error(`Meeting update failed: ${updateErr.message}`);

    // ============ Best-of-All consolidation (graceful degradation) ============
    // Runs BoA over Whisper + Deepgram chunks (mobile path has no AssemblyAI).
    // If consolidation fails or times out we PROCEED with Whisper-only —
    // a mobile user cannot re-record, so notes MUST always be generated.
    // auto-generate-meeting-notes already prefers best_of_all_transcript when
    // present and falls back to whisper_transcript_text automatically.
    try {
      const boaCtrl = new AbortController();
      const boaTimeout = setTimeout(() => boaCtrl.abort(), 90_000);
      const boaResp = await fetch(`${supabaseUrl}/functions/v1/consolidate-meeting-chunks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({ meetingId }),
        signal: boaCtrl.signal,
      });
      clearTimeout(boaTimeout);
      if (!boaResp.ok) {
        const boaErr = await boaResp.text().catch(() => "");
        console.warn(`⚠️ BoA consolidation returned ${boaResp.status} for ${meetingId}, proceeding with Whisper-only fallback: ${boaErr.slice(0, 200)}`);
      } else {
        await boaResp.text();
        console.log(`✅ BoA consolidation complete for ${meetingId}`);
      }
    } catch (boaErr) {
      console.warn(`⚠️ BoA consolidation failed for ${meetingId} (${boaErr instanceof Error ? boaErr.message : String(boaErr)}), proceeding with Whisper-only fallback`);
    }

    const genResp = await fetch(`${supabaseUrl}/functions/v1/auto-generate-meeting-notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        apikey: serviceKey,
      },
      body: JSON.stringify({ meetingId }),
    });

    if (!genResp.ok) {
      const genText = await genResp.text();
      console.warn(`auto-generate-meeting-notes returned ${genResp.status}: ${genText}`);
    } else {
      await genResp.text();
    }

    return new Response(JSON.stringify({
      success: true,
      status: "completed",
      chunks: totalChunks,
      stitchedChunkCount: stitchedChunks.length,
      transcriptLength: fullTranscript.length,
      wordCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});