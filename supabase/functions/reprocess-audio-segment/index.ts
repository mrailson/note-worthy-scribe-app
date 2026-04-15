import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, backupId, segmentIndex, meetingId, fullTranscript, wordCount } =
      await req.json();

    // ── LIST: return audio files in the backup folder ──────────────
    if (action === "list") {
      if (!backupId) return json({ error: "backupId required" }, 400);

      // backupId is the file_path from meeting_audio_backups — derive the folder
      // file_path is typically like "userId/meeting-meetingId-session-xxx/segment_0.webm"
      const folderPath = backupId.substring(0, backupId.lastIndexOf("/"));

      const { data: files, error } = await supabaseAdmin.storage
        .from("meeting-audio-backups")
        .list(folderPath, { limit: 200 });

      if (error) return json({ error: error.message }, 500);

      const audioExts = [".webm", ".m4a", ".mp3", ".wav", ".ogg", ".weba"];
      const audioFiles = (files || [])
        .filter((f: any) => f.id && audioExts.some((ext) => f.name.toLowerCase().endsWith(ext)))
        .sort((a: any, b: any) => {
          const numA = parseInt(a.name.match(/(\d+)/)?.[1] || "0");
          const numB = parseInt(b.name.match(/(\d+)/)?.[1] || "0");
          return numA - numB;
        })
        .map((f: any) => ({
          name: f.name,
          size: (f.metadata as any)?.size || 0,
          fullPath: `${folderPath}/${f.name}`,
        }));

      return json({ success: true, segments: audioFiles, folderPath });
    }

    // ── TRANSCRIBE: process ONE segment ────────────────────────────
    if (action === "transcribe") {
      if (!backupId || segmentIndex === undefined)
        return json({ error: "backupId and segmentIndex required" }, 400);

      const folderPath = backupId.substring(0, backupId.lastIndexOf("/"));

      // List and find the target segment
      const { data: files, error: listErr } = await supabaseAdmin.storage
        .from("meeting-audio-backups")
        .list(folderPath, { limit: 200 });

      if (listErr) return json({ error: listErr.message }, 500);

      const audioExts = [".webm", ".m4a", ".mp3", ".wav", ".ogg", ".weba"];
      const audioFiles = (files || [])
        .filter((f: any) => f.id && audioExts.some((ext) => f.name.toLowerCase().endsWith(ext)))
        .sort((a: any, b: any) => {
          const numA = parseInt(a.name.match(/(\d+)/)?.[1] || "0");
          const numB = parseInt(b.name.match(/(\d+)/)?.[1] || "0");
          return numA - numB;
        });

      if (segmentIndex >= audioFiles.length) {
        return json({ error: `Segment ${segmentIndex} not found (${audioFiles.length} total)` }, 400);
      }

      const targetFile = audioFiles[segmentIndex];
      const filePath = `${folderPath}/${targetFile.name}`;

      console.log(`📥 Downloading segment ${segmentIndex}: ${filePath}`);

      const { data: audioData, error: dlErr } = await supabaseAdmin.storage
        .from("meeting-audio-backups")
        .download(filePath);

      if (dlErr || !audioData) {
        return json({ error: `Download failed: ${dlErr?.message || "no data"}` }, 500);
      }

      console.log(`🎙️ Transcribing segment ${segmentIndex} (${(audioData.size / 1024 / 1024).toFixed(1)} MB)`);

      // Send to OpenAI Whisper
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

      const ext = targetFile.name.split(".").pop() || "webm";
      const formData = new FormData();
      formData.append("file", new File([audioData], `segment_${segmentIndex}.${ext}`));
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      formData.append("response_format", "text");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        console.error(`Whisper error for segment ${segmentIndex}:`, errText);
        return json({ error: `Whisper API error: ${whisperRes.status}` }, 500);
      }

      const text = (await whisperRes.text()).trim();
      const segWordCount = text ? text.split(/\s+/).filter((w: string) => w.length > 0).length : 0;

      console.log(`✅ Segment ${segmentIndex}: ${segWordCount} words`);

      return json({
        success: true,
        segmentIndex,
        text,
        wordCount: segWordCount,
        fileName: targetFile.name,
      });
    }

    // ── SAVE: persist combined transcript ──────────────────────────
    if (action === "save") {
      if (!meetingId || !fullTranscript)
        return json({ error: "meetingId and fullTranscript required" }, 400);

      const finalWordCount =
        wordCount ||
        fullTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

      const { error: updateErr } = await supabaseAdmin
        .from("meetings")
        .update({
          whisper_transcript_text: fullTranscript,
          word_count: finalWordCount,
        })
        .eq("id", meetingId);

      if (updateErr) {
        console.error("Failed to save transcript:", updateErr);
        return json({ error: updateErr.message }, 500);
      }

      console.log(`💾 Saved transcript for meeting ${meetingId}: ${finalWordCount} words`);

      return json({ success: true, meetingId, wordCount: finalWordCount });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("reprocess-audio-segment error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
