import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

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

function stitchChunkTexts(chunks: Array<{ chunk_number: number; transcription_text: string }>): string {
  const ordered = chunks
    .filter((chunk) => chunk?.transcription_text)
    .sort((a, b) => a.chunk_number - b.chunk_number);

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

async function getChunkSources(meetingId: string) {
  const { data: audioChunks, error: chunkError } = await supabase
    .from("audio_chunks")
    .select("chunk_number, audio_blob_path")
    .eq("meeting_id", meetingId)
    .not("audio_blob_path", "is", null)
    .order("chunk_number", { ascending: true });

  if (chunkError) {
    console.warn("Failed to read audio_chunks metadata:", chunkError);
  }

  if (audioChunks && audioChunks.length > 0) {
    return audioChunks.map((chunk) => ({
      chunkNumber: chunk.chunk_number,
      storagePath: chunk.audio_blob_path as string,
      bucket: "recordings",
    }));
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
    return backups.map((backup, index) => ({
      chunkNumber: index,
      storagePath: backup.file_path,
      bucket: "meeting-audio-backups",
    }));
  }

  const { data: files, error: listErr } = await supabase.storage
    .from("recordings")
    .list(meetingId, { sortBy: { column: "name", order: "asc" } });

  if (listErr) {
    throw new Error(`Storage list failed: ${listErr.message}`);
  }

  return (files || []).map((file, index) => ({
    chunkNumber: index,
    storagePath: `${meetingId}/${file.name}`,
    bucket: "recordings",
  }));
}

async function transcribeStoragePath(storagePath: string, bucket: string, prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("standalone-whisper", {
    body: {
      storagePath,
      bucket,
      responseFormat: "verbose_json",
      prompt,
    },
  });

  if (error) {
    throw new Error(error.message || `Transcription failed for ${storagePath}`);
  }

  return String(data?.text || "").replace(/\s+/g, " ").trim();
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
      .select("id, user_id, title")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) throw new Error("Meeting not found");

    // Ownership check: if caller is NOT the service role, verify they own the meeting
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (bearerToken && bearerToken !== serviceKey) {
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

    const chunkSources = await getChunkSources(meetingId);
    if (!chunkSources.length) throw new Error("No audio files found for this meeting");
    if (numericChunkIndex >= chunkSources.length) {
      throw new Error(`Chunk ${numericChunkIndex} is out of range for ${chunkSources.length} chunks`);
    }

    const totalChunks = chunkSources.length;
    const sessionId = `offline-retranscribe-${meetingId}`;

    if (numericChunkIndex === 0) {
      await supabase.from("meetings").update({
        notes_generation_status: "transcribing",
      }).eq("id", meetingId);

      await supabase.from("meeting_transcription_chunks")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("session_id", sessionId);
    }

    const source = chunkSources[numericChunkIndex];

    const { data: existing } = await supabase
      .from("meeting_transcription_chunks")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("session_id", sessionId)
      .eq("chunk_number", source.chunkNumber)
      .maybeSingle();

    if (!existing) {
      const prompt = `NHS primary care meeting transcript.${meeting.title ? ` Meeting: ${meeting.title}.` : ""}`;
      let chunkText: string;
      try {
        chunkText = await transcribeStoragePath(source.storagePath, source.bucket, prompt);
      } catch (transcribeErr) {
        // Mark failure server-side so it's visible even when client has disconnected
        await supabase.from("meetings").update({
          notes_generation_status: "failed",
        }).eq("id", meetingId);
        throw transcribeErr;
      }

      await supabase.from("meeting_transcription_chunks").insert({
        meeting_id: meetingId,
        chunk_number: source.chunkNumber,
        transcription_text: chunkText,
        user_id: meeting.user_id,
        session_id: sessionId,
        is_final: true,
        source: "whisper",
        transcriber_type: "whisper",
        word_count: chunkText.split(/\s+/).filter(Boolean).length,
      });
    } else {
      console.log(`⏭️ Chunk ${source.chunkNumber} already transcribed, skipping`);
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
      .select("chunk_number, transcription_text")
      .eq("meeting_id", meetingId)
      .eq("session_id", sessionId)
      .order("chunk_number", { ascending: true });

    if (fetchErr) throw new Error(`Failed to fetch chunks: ${fetchErr.message}`);

    const fullTranscript = stitchChunkTexts(allChunks || []);
    const wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;

    if (!fullTranscript || wordCount === 0) {
      throw new Error("Stitched transcript was empty despite chunks existing");
    }

    // Guard: too short to generate useful notes
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