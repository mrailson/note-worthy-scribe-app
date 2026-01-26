import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, imageData, fileName } = await req.json();

    if (!sessionToken || !imageData || !fileName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing document upload for session token:", sessionToken.substring(0, 8) + "...");

    // Validate session token
    const { data: session, error: sessionError } = await supabase
      .from("reception_translation_sessions")
      .select("id, user_id, patient_language, expires_at, is_active")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      console.error("Session lookup error:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Session is no longer active" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Session has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
    const base64Data = base64Match ? base64Match[1] : imageData;
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const filePath = `${session.id}/${timestamp}-${fileName}`;

    console.log("Uploading to storage:", filePath);

    // Upload to storage bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("translation-documents")
      .upload(filePath, bytes, {
        contentType: "image/jpeg",
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("translation-documents")
      .getPublicUrl(filePath);

    // Generate thumbnail (smaller version for preview)
    const thumbnailPath = `${session.id}/thumbnails/${timestamp}-${fileName}`;

    // Create record in translation_documents table
    const { data: docRecord, error: docError } = await supabase
      .from("translation_documents")
      .insert({
        session_id: session.id,
        file_name: fileName,
        file_type: "image/jpeg",
        file_url: urlData.publicUrl,
        thumbnail_url: urlData.publicUrl, // Using same URL for now
        status: "pending",
        uploaded_by: "clinician"
      })
      .select()
      .single();

    if (docError) {
      console.error("Database insert error:", docError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save document record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Document uploaded successfully:", docRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        documentId: docRecord.id,
        fileUrl: urlData.publicUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
