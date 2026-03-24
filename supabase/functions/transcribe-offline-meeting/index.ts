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
    const { meetingId } = await req.json();
    if (!meetingId) throw new Error("meetingId required");

    console.log(`🎙️ Transcribing offline meeting: ${meetingId}`);

    // Get audio chunks from storage
    const { data: files, error: listErr } = await supabase.storage
      .from("recordings")
      .list(meetingId, { sortBy: { column: "name", order: "asc" } });

    if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);
    if (!files || files.length === 0) throw new Error("No audio files found");

    console.log(`📂 Found ${files.length} audio chunks`);

    const transcripts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${meetingId}/${file.name}`;
      console.log(`🔄 Processing chunk ${i + 1}/${files.length}: ${file.name} (${file.metadata?.size || '?'} bytes)`);

      // Download from storage
      const { data: blob, error: dlErr } = await supabase.storage
        .from("recordings")
        .download(path);

      if (dlErr || !blob) {
        console.error(`❌ Download failed for ${file.name}: ${dlErr?.message}`);
        continue;
      }

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
        console.error(`❌ Whisper failed for chunk ${i}: ${whisperResp.status} ${errText}`);
        continue;
      }

      const result = await whisperResp.json();
      const text = result.text?.trim() || "";
      console.log(`✅ Chunk ${i}: ${text.length} chars`);
      if (text) transcripts.push(text);
    }

    const fullTranscript = transcripts.join("\n\n");
    console.log(`📝 Full transcript: ${fullTranscript.length} chars, ${fullTranscript.split(/\s+/).length} words`);

    // Update meeting with transcript
    const { error: updateErr } = await supabase
      .from("meetings")
      .update({
        whisper_transcript_text: fullTranscript,
        primary_transcript_source: "whisper",
        word_count: fullTranscript.split(/\s+/).filter((w: string) => w.length > 0).length,
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

    return new Response(
      JSON.stringify({
        success: true,
        chunks: files.length,
        transcriptLength: fullTranscript.length,
        wordCount: fullTranscript.split(/\s+/).filter((w: string) => w.length > 0).length,
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
