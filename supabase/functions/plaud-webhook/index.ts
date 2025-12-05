import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, plaud-signature',
};

// HMAC-SHA256 signature verification
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computedSignature === signature.toLowerCase();
}

// Generate meeting title from transcript
function generateTitle(transcript: string, filename?: string): string {
  if (filename) {
    // Clean up filename
    const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (cleanName.length > 5) return cleanName;
  }
  
  // Extract first meaningful sentence from transcript
  const firstLine = transcript.split(/[.\n]/)[0]?.trim();
  if (firstLine && firstLine.length > 10 && firstLine.length < 100) {
    return firstLine;
  }
  
  // Default title with timestamp
  const now = new Date();
  return `Plaud Recording - ${now.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    
    console.log('Plaud webhook received:', {
      event: payload.event,
      hasTranscript: !!payload.data?.transcript,
      filename: payload.data?.filename
    });

    // Extract signature from headers
    const signature = req.headers.get('plaud-signature') || req.headers.get('x-plaud-signature');
    
    // Determine the event type
    const eventType = payload.event || payload.type;
    
    // Only process transcription completed events
    if (eventType !== 'audio_transcribe.completed' && eventType !== 'transcription.completed') {
      console.log('Ignoring non-transcription event:', eventType);
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract data from payload (handle different Plaud API versions)
    const data = payload.data || payload;
    const transcript = data.transcript || data.text || data.transcription;
    const filename = data.filename || data.file_name || data.title;
    const duration = data.duration || data.duration_seconds;
    const recordedAt = data.recorded_at || data.created_at || data.timestamp;
    const userEmail = data.user_email || data.email;
    const userId = data.user_id;

    if (!transcript) {
      console.error('No transcript in payload');
      return new Response(JSON.stringify({ error: 'No transcript provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the user by email or user_id from Plaud
    let targetUserId: string | null = null;
    
    if (userEmail) {
      const { data: userData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', userEmail)
        .single();
      
      if (userData) {
        targetUserId = userData.user_id;
      }
    }

    // If no user found by email, check for users with Plaud integration enabled
    if (!targetUserId) {
      // Get all enabled Plaud integrations
      const { data: integrations } = await supabase
        .from('plaud_integrations')
        .select('user_id, webhook_secret')
        .eq('enabled', true);
      
      if (integrations && integrations.length > 0) {
        // If signature provided, verify against each user's webhook secret
        if (signature) {
          for (const integration of integrations) {
            if (integration.webhook_secret) {
              const isValid = await verifySignature(rawBody, signature, integration.webhook_secret);
              if (isValid) {
                targetUserId = integration.user_id;
                console.log('User identified via webhook signature');
                break;
              }
            }
          }
        }
        
        // If still no user and only one integration exists, use that
        if (!targetUserId && integrations.length === 1) {
          targetUserId = integrations[0].user_id;
          console.log('Using single registered Plaud integration user');
        }
      }
    }

    if (!targetUserId) {
      console.error('Could not identify target user for Plaud transcript');
      return new Response(JSON.stringify({ 
        error: 'User not found. Please configure Plaud integration in settings.' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Plaud integration settings
    const { data: integration } = await supabase
      .from('plaud_integrations')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    // Calculate word count
    const wordCount = transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
    
    // Generate title
    const title = generateTitle(transcript, filename);
    
    // Calculate duration in minutes
    const durationMinutes = duration ? Math.ceil(duration / 60) : null;
    const durationString = durationMinutes ? `${durationMinutes} minutes` : null;

    // Create meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        user_id: targetUserId,
        title: title,
        status: 'completed',
        import_source: 'plaud',
        meeting_type: integration?.default_meeting_type || 'imported',
        start_time: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration: durationString,
        word_count: wordCount,
        transcript: transcript,
        live_transcript_text: transcript,
        notes_generation_status: integration?.auto_generate_notes ? 'queued' : 'pending',
      })
      .select()
      .single();

    if (meetingError) {
      console.error('Failed to create meeting:', meetingError);
      throw meetingError;
    }

    console.log('Meeting created:', meeting.id);

    // Store transcript in chunks table for consistency
    const { error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .insert({
        meeting_id: meeting.id,
        user_id: targetUserId,
        session_id: `plaud-${Date.now()}`,
        chunk_number: 1,
        transcription_text: transcript,
        word_count: wordCount,
        cleaning_status: 'completed',
        cleaned_text: transcript,
      });

    if (chunkError) {
      console.error('Failed to store transcript chunk:', chunkError);
    }

    // Queue automatic notes generation if enabled
    if (integration?.auto_generate_notes) {
      const { error: queueError } = await supabase
        .from('meeting_notes_queue')
        .insert({
          meeting_id: meeting.id,
          status: 'pending',
          note_type: 'standard',
          detail_level: 'standard',
        });

      if (queueError) {
        console.error('Failed to queue notes generation:', queueError);
      } else {
        console.log('Notes generation queued for meeting:', meeting.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      meeting_id: meeting.id,
      title: title,
      word_count: wordCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Plaud webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
