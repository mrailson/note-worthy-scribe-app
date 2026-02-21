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
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('mp4') || t.includes('m4a')) return 'm4a';
  if (t.includes('wav')) return 'wav';
  if (t.includes('aac')) return 'aac';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('webm')) return 'webm';
  return 'bin';
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("upload-ai-chat-capture: incoming request", { method: req.method });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error("Failed to parse formData:", formError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse form data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenValue = formData.get("token");
    const shortCodeValue = formData.get("shortCode");
    const fileValue = formData.get("file");
    const actionValue = formData.get("action");

    const action = typeof actionValue === "string" ? actionValue : null;
    const isAudioImport = action === "audio-import";

    console.log("FormData parsed:", {
      hasToken: !!tokenValue,
      hasShortCode: !!shortCodeValue,
      hasFile: !!fileValue,
      action: action || 'default',
    });

    const token = typeof tokenValue === "string" ? tokenValue : null;
    const shortCode = typeof shortCodeValue === "string" ? shortCodeValue : null;

    const fileBlob =
      fileValue instanceof File
        ? fileValue
        : fileValue instanceof Blob
          ? fileValue
          : null;

    const originalName = fileValue instanceof File ? fileValue.name : `upload-${Date.now()}.${isAudioImport ? 'mp3' : 'jpg'}`;
    const contentType =
      (fileValue && typeof (fileValue as any).type === "string" && (fileValue as any).type) ||
      (isAudioImport ? "audio/mpeg" : "image/jpeg");
    const fileSize =
      (fileValue && typeof (fileValue as any).size === "number" && (fileValue as any).size) ||
      null;

    if ((!token && !shortCode) || !fileBlob) {
      console.error("Missing required fields:", { token: !!token, shortCode: !!shortCode, fileBlob: !!fileBlob });
      return new Response(
        JSON.stringify({ success: false, error: "Token/shortCode and file are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route to appropriate table/bucket based on action
    const sessionTable = isAudioImport ? "audio_import_sessions" : "ai_chat_capture_sessions";
    const storageBucket = isAudioImport ? "audio-imports" : "ai-chat-captures";
    const uploadsTable = isAudioImport ? "audio_import_uploads" : "ai_chat_captured_images";

    const lookupValue = shortCode || token!;
    const lookupField = shortCode ? "short_code" : "session_token";

    console.log(`Processing upload [${action || 'default'}] by ${lookupField}:`, lookupValue.substring(0, 6) + "...", {
      name: originalName, type: contentType, size: fileSize,
    });

    // Validate the session
    const { data: session, error: sessionError } = await supabase
      .from(sessionTable)
      .select("id, user_id, expires_at, is_active")
      .eq(lookupField, lookupValue)
      .single();

    if (sessionError || !session) {
      console.error("Session lookup error:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
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

    console.log("Session validated:", session.id);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const extension = inferExtension(originalName, contentType);
    const fileName = `${session.id}/${timestamp}-${randomId}.${extension}`;

    // Upload file to storage
    const arrayBuffer = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    console.log("Uploading to storage:", { bucket: storageBucket, fileName, size: bytes.length });

    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(fileName, bytes, { contentType, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to upload file: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(storageBucket)
      .getPublicUrl(fileName);

    // Record the upload in the appropriate table
    const insertPayload = isAudioImport
      ? {
          session_id: session.id,
          file_name: originalName,
          file_url: urlData.publicUrl,
          file_size: fileSize,
          mime_type: contentType,
          storage_path: fileName,
        }
      : {
          session_id: session.id,
          file_name: originalName,
          file_url: urlData.publicUrl,
          file_size: fileSize,
        };

    const { data: record, error: insertError } = await supabase
      .from(uploadsTable)
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to record upload: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Upload successful:", record.id);

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: record.id,
          file_name: record.file_name,
          file_url: record.file_url,
          file_size: record.file_size,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
