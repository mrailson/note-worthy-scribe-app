// supabase/functions/repair-transcript-chunks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔧 Starting transcript chunk repair...");
    
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: "Missing meetingId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📋 Fetching unprocessed chunks for meeting: ${meetingId}`);

    // Fetch all chunks with null cleaned_text or pending status
    const { data: chunks, error: fetchError } = await supabase
      .from("meeting_transcription_chunks")
      .select("id, chunk_number, transcription_text, cleaned_text, cleaning_status")
      .eq("meeting_id", meetingId)
      .or("cleaned_text.is.null,cleaning_status.eq.pending")
      .order("chunk_number", { ascending: true });

    if (fetchError) {
      console.error("❌ Error fetching chunks:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chunks", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${chunks?.length || 0} unprocessed chunks`);

    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No unprocessed chunks found",
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each chunk
    for (const chunk of chunks) {
      try {
        console.log(`🔄 Processing chunk ${chunk.chunk_number}...`);
        
        let cleanedText = "";
        
        // Parse the transcription_text if it's JSON
        if (typeof chunk.transcription_text === "string") {
          try {
            const parsed = JSON.parse(chunk.transcription_text);
            if (Array.isArray(parsed)) {
              // Extract text from segments array
              cleanedText = parsed.map((seg: any) => seg.text || "").join(" ").trim();
            } else {
              cleanedText = chunk.transcription_text;
            }
          } catch {
            // Not JSON, use as-is
            cleanedText = chunk.transcription_text;
          }
        } else if (Array.isArray(chunk.transcription_text)) {
          // Already an array of segments
          cleanedText = chunk.transcription_text.map((seg: any) => seg.text || "").join(" ").trim();
        } else {
          cleanedText = String(chunk.transcription_text || "");
        }

        if (!cleanedText) {
          console.warn(`⚠️ Chunk ${chunk.chunk_number} has no extractable text`);
          errorCount++;
          errors.push(`Chunk ${chunk.chunk_number}: No text extracted`);
          continue;
        }

        // Update the chunk with cleaned text
        const { error: updateError } = await supabase
          .from("meeting_transcription_chunks")
          .update({
            cleaned_text: cleanedText,
            cleaning_status: "completed",
            cleaned_at: new Date().toISOString(),
          })
          .eq("id", chunk.id);

        if (updateError) {
          console.error(`❌ Error updating chunk ${chunk.chunk_number}:`, updateError);
          errorCount++;
          errors.push(`Chunk ${chunk.chunk_number}: ${updateError.message}`);
        } else {
          processedCount++;
          console.log(`✅ Chunk ${chunk.chunk_number} processed (${cleanedText.length} chars)`);
        }
      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${chunk.chunk_number}:`, chunkError);
        errorCount++;
        errors.push(`Chunk ${chunk.chunk_number}: ${chunkError.message}`);
      }
    }

    // After processing all chunks, update the meeting's word count
    console.log("📊 Calculating total word count...");
    
    const { data: allChunks, error: countError } = await supabase
      .from("meeting_transcription_chunks")
      .select("cleaned_text")
      .eq("meeting_id", meetingId)
      .not("cleaned_text", "is", null);

    if (!countError && allChunks) {
      const totalText = allChunks.map(c => c.cleaned_text || "").join(" ");
      const wordCount = totalText.split(/\s+/).filter(w => w.length > 0).length;
      
      const { error: updateMeetingError } = await supabase
        .from("meetings")
        .update({ word_count: wordCount })
        .eq("id", meetingId);

      if (updateMeetingError) {
        console.error("❌ Error updating meeting word count:", updateMeetingError);
      } else {
        console.log(`✅ Meeting word count updated to: ${wordCount}`);
      }
    }

    console.log(`🎉 Repair complete: ${processedCount} processed, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
        message: `Successfully processed ${processedCount} chunks${errorCount > 0 ? ` with ${errorCount} errors` : ""}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Repair function error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Repair failed", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
