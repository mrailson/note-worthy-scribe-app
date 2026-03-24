import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { meetingId, chunkIndex = 0 } = await req.json();
    if (!meetingId) throw new Error("meetingId required");

    console.log(`🎙️ Transcribing offline meeting: ${meetingId}, chunk ${chunkIndex}`);

    // Get meeting user_id for required fields
    const { data: meeting } = await supabase
      .from("meetings")
      .select("user_id")
      .eq("id", meetingId)
      .single();

    if (!meeting) throw new Error("Meeting not found");
    const userId = meeting.user_id;
    const sessionId = `offline-retranscribe-${meetingId}`;

    // List audio files
    const { data: files, error: listErr } = await supabase.storage
      .from("recordings")
      .list(meetingId, { sortBy: { column: "name", order: "asc" } });

    if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);
    if (!files || files.length === 0) throw new Error("No audio files found");

    const totalChunks = files.length;
    console.log(`📂 Total chunks: ${totalChunks}, processing chunk ${chunkIndex}`);

    // Update meeting status on first chunk
    if (chunkIndex === 0) {
      await supabase.from("meetings").update({
        notes_generation_status: "transcribing",
      }).eq("id", meetingId);

      // Clear any previous transcription chunks for this session (fresh start)
      await supabase.from("meeting_transcription_chunks")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("session_id", sessionId);
    }

    // Check if this chunk is already transcribed (idempotent)
    const { data: existing } = await supabase
      .from("meeting_transcription_chunks")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("session_id", sessionId)
      .eq("chunk_number", chunkIndex)
      .maybeSingle();

    let chunkText = "";

    if (existing) {
      console.log(`⏭️ Chunk ${chunkIndex} already transcribed, skipping`);
    } else {
      // Process this specific chunk
      const file = files[chunkIndex];
      if (!file) throw new Error(`Chunk ${chunkIndex} not found in storage`);

      const path = `${meetingId}/${file.name}`;
      console.log(`🔄 Downloading chunk ${chunkIndex}: ${file.name}`);

      const { data: blob, error: dlErr } = await supabase.storage
        .from("recordings")
        .download(path);

      if (dlErr || !blob) throw new Error(`Download failed for ${file.name}: ${dlErr?.message}`);

      const audioBytes = new Uint8Array(await blob.arrayBuffer());
      console.log(`📦 Downloaded ${audioBytes.length} bytes`);

      // Send to Whisper
      const formData = new FormData();
      formData.append("file", new Blob([audioBytes], { type: "audio/webm" }), file.name);
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      formData.append("temperature", "0");

      const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });

      if (!whisperResp.ok) {
        const errText = await whisperResp.text();
        throw new Error(`Whisper failed for chunk ${chunkIndex}: ${whisperResp.status} ${errText}`);
      }

      const result = await whisperResp.json();
      chunkText = result.text?.trim() || "";
      console.log(`✅ Chunk ${chunkIndex}: ${chunkText.length} chars`);

      // Save chunk transcript to DB
      await supabase.from("meeting_transcription_chunks").insert({
        meeting_id: meetingId,
        chunk_number: chunkIndex,
        transcription_text: chunkText,
        user_id: userId,
        session_id: sessionId,
      });
    }

    const nextChunk = chunkIndex + 1;

    if (nextChunk < totalChunks) {
      // Self-invoke for next chunk
      console.log(`🔗 Chaining to chunk ${nextChunk}/${totalChunks}`);
      
      const chainResp = await fetch(`${supabaseUrl}/functions/v1/transcribe-offline-meeting`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({ meetingId, chunkIndex: nextChunk }),
      });

      // Don't await the full response body — just check status
      if (!chainResp.ok) {
        const errText = await chainResp.text();
        console.error(`❌ Chain call failed: ${chainResp.status} ${errText}`);
      } else {
        // Consume body to avoid leak
        await chainResp.text();
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "processing",
          chunk: chunkIndex,
          totalChunks,
          message: `Chunk ${chunkIndex} done, processing ${nextChunk} next`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === FINAL CHUNK — stitch everything together ===
    console.log(`🧵 All ${totalChunks} chunks done. Stitching transcript...`);

    const { data: allChunks, error: fetchErr } = await supabase
      .from("meeting_transcription_chunks")
      .select("chunk_index, transcript_text")
      .eq("meeting_id", meetingId)
      .order("chunk_index", { ascending: true });

    if (fetchErr) throw new Error(`Failed to fetch chunks: ${fetchErr.message}`);

    const fullTranscript = (allChunks || [])
      .map((c: any) => c.transcript_text)
      .filter(Boolean)
      .join("\n\n");

    const wordCount = fullTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
    console.log(`📝 Full transcript: ${fullTranscript.length} chars, ${wordCount} words`);

    // Update meeting with transcript
    const { error: updateErr } = await supabase
      .from("meetings")
      .update({
        whisper_transcript_text: fullTranscript,
        primary_transcript_source: "whisper",
        word_count: wordCount,
        notes_generation_status: "queued",
      })
      .eq("id", meetingId);

    if (updateErr) throw new Error(`Meeting update failed: ${updateErr.message}`);

    // Trigger note generation
    console.log(`🚀 Triggering note generation...`);
    const genResp = await fetch(`${supabaseUrl}/functions/v1/auto-generate-meeting-notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        apikey: serviceKey,
      },
      body: JSON.stringify({ meetingId }),
    });

    const genResult = await genResp.json();
    console.log(`📋 Note generation response:`, genResult);

    // Clean up transcription chunks
    await supabase.from("meeting_transcription_chunks").delete().eq("meeting_id", meetingId);

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        chunks: totalChunks,
        transcriptLength: fullTranscript.length,
        wordCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
