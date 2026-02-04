import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  sessionId: string;
  imageData: string;
  fileName: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: RequestBody = await req.json();
    const { sessionId, imageData, fileName } = body;
    
    if (!sessionId || !imageData || !fileName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from('mock_inspection_capture_sessions')
      .select('id, expires_at, is_active, user_id, element_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if session is active and not expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (!session.is_active || expiresAt < now) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract base64 data
    const base64Data = imageData.includes(',') 
      ? imageData.split(',')[1] 
      : imageData;
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Generate unique file path
    const timestamp = Date.now();
    const uniqueFileName = `${session.user_id}/${session.element_id}/${timestamp}-${fileName}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('inspection-captures')
      .upload(uniqueFileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('inspection-captures')
      .getPublicUrl(uniqueFileName);
    
    // Insert record into captured images table
    const { data: insertData, error: insertError } = await supabase
      .from('mock_inspection_captured_images')
      .insert({
        session_id: sessionId,
        file_name: fileName,
        file_url: publicUrlData.publicUrl,
        file_size: bytes.length
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Successfully uploaded inspection capture: ${uniqueFileName}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageId: insertData.id,
        fileUrl: publicUrlData.publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
