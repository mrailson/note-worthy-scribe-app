import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const inferExtension = (name: string | undefined, mimeType: string | undefined) => {
  const safeName = name?.trim();
  const fromName = safeName?.includes('.') ? safeName.split('.').pop()?.toLowerCase() : undefined;
  if (fromName) return fromName;

  const t = (mimeType || '').toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('heic')) return 'heic';
  if (t.includes('heif')) return 'heif';
  return 'jpg';
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Safari/iOS is picky about preflight responses; always return a body.
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("upload-ai-chat-capture: incoming request", { method: req.method });

    const formData = await req.formData();
    const tokenValue = formData.get("token");
    const fileValue = formData.get("file");

    const token = typeof tokenValue === "string" ? tokenValue : null;

    // Some clients can send a Blob without filename metadata.
    const fileBlob =
      fileValue instanceof File
        ? fileValue
        : fileValue instanceof Blob
          ? fileValue
          : null;

    const originalName = fileValue instanceof File ? fileValue.name : undefined;
    const contentType =
      (fileValue && typeof (fileValue as any).type === "string" && (fileValue as any).type) ||
      "application/octet-stream";
    const fileSize =
      (fileValue && typeof (fileValue as any).size === "number" && (fileValue as any).size) ||
      null;

    if (!token || !fileBlob) {
      return new Response(
        JSON.stringify({ success: false, error: "Token and file are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing upload for token:", token.substring(0, 8) + "...", {
      name: originalName,
      type: contentType,
      size: fileSize,
    });

    // Validate the session token
    const { data: session, error: sessionError } = await supabase
      .from("ai_chat_capture_sessions")
      .select("id, user_id, expires_at, is_active")
      .eq("session_token", token)
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

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const extension = inferExtension(originalName, contentType);
    const fileName = `${session.id}/${timestamp}-${randomId}.${extension}`;

    // Upload file to storage
    const arrayBuffer = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("ai-chat-captures")
      .upload(fileName, bytes, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to upload file: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("ai-chat-captures")
      .getPublicUrl(fileName);

    // Record the uploaded image in the database
    const { data: imageRecord, error: insertError } = await supabase
      .from("ai_chat_captured_images")
      .insert({
        session_id: session.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to record upload: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Upload successful:", imageRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: imageRecord.id,
          file_name: imageRecord.file_name,
          file_url: imageRecord.file_url,
          file_size: imageRecord.file_size
        }
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
