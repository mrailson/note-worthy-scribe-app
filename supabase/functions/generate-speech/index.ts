import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Text preprocessing for better speech
function preprocessText(text: string): string {
  let processed = text;
  
  // Replace GP with G.P. for better pronunciation
  processed = processed.replace(/\bGP\b/g, 'G.P.');
  processed = processed.replace(/\bGPs\b/g, 'G.P.s');
  
  // Expand common NHS acronyms
  const acronyms: Record<string, string> = {
    'CCG': 'Clinical Commissioning Group',
    'ICB': 'Integrated Care Board',
    'PCN': 'Primary Care Network',
    'QOF': 'Quality and Outcomes Framework',
    'CQC': 'Care Quality Commission',
    'NICE': 'National Institute for Health and Care Excellence',
    'NHS': 'N.H.S.',
    'A&E': 'A and E',
    'GP': 'G.P.',
  };
  
  for (const [acronym, expansion] of Object.entries(acronyms)) {
    const regex = new RegExp(`\\b${acronym}\\b`, 'g');
    processed = processed.replace(regex, expansion);
  }
  
  // Format numbers with commas
  processed = processed.replace(/£(\d{1,3}(?:,\d{3})+)/g, (match, number) => {
    const num = number.replace(/,/g, '');
    return `£${parseInt(num).toLocaleString()}`;
  });
  
  // Remove extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { text, voiceId = 'chris', quality = 'standard', preprocess = true, projectName } = await req.json()

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required')
    }

    if (text.length > 5000) {
      throw new Error('Text must be 5000 characters or less')
    }

    // Preprocess text if enabled
    const processedText = preprocess ? preprocessText(text) : text;
    const characterCount = processedText.length;

    console.log(`Generating speech for user ${user.id}, ${characterCount} characters, voice: ${voiceId}`);

    // Get voice config from voice ID
    const voiceConfig: Record<string, string> = {
      chris: 'G17SuINrv2H9FC6nvetn',
      alice: 'Xb7hH8MSUJpSbSDYk0k2'
    };

    const elevenlabsVoiceId = voiceConfig[voiceId] || voiceConfig.chris;

    // Call elevenlabs-tts function
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
      body: {
        text: processedText,
        voiceId: elevenlabsVoiceId
      }
    });

    if (ttsError) {
      console.error('TTS error:', ttsError);
      throw new Error(`TTS generation failed: ${ttsError.message}`);
    }

    if (!ttsData || !ttsData.audioContent) {
      throw new Error('No audio content received from TTS service');
    }

    // Convert base64 to blob
    const audioBlob = Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0));
    
    // Generate unique filename
    const filename = `${user.id}/${crypto.randomUUID()}.mp3`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ai4pm-speech')
      .upload(filename, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('ai4pm-speech')
      .getPublicUrl(filename);

    // Estimate duration (rough estimate: 150 words per minute, ~5 chars per word)
    const estimatedDuration = Math.ceil((characterCount / 5) / 150 * 60);

    // Save to history
    const { data: historyData, error: historyError } = await supabase
      .from('ai4pm_speech_history')
      .insert({
        user_id: user.id,
        text_content: text, // Store original text
        voice_id: voiceId,
        audio_url: publicUrl,
        duration_seconds: estimatedDuration,
        character_count: characterCount,
        audio_quality: quality,
        project_name: projectName || null
      })
      .select()
      .single();

    if (historyError) {
      console.error('History save error:', historyError);
      // Don't fail the request if history save fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: publicUrl,
        duration: estimatedDuration,
        characterCount,
        historyId: historyData?.id,
        preprocessedText: preprocess ? processedText : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Generate speech error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
