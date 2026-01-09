import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideNumber, slideContent, speakerNotes, voiceId } = await req.json();

    console.log(`[Narration] Generating audio for slide ${slideNumber}, voice: ${voiceId}`);
    console.log(`[Narration] Script length: ${speakerNotes?.length || 0} characters`);

    if (!speakerNotes || !speakerNotes.trim()) {
      throw new Error('Speaker notes are required for narration');
    }

    // Get ElevenLabs API key
    const elevenLabsKey = Deno.env.get('ELEVEN_LABS_API_KEY') || Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsKey) {
      console.error('[Narration] ElevenLabs API key not configured');
      throw new Error('ElevenLabs API key not configured');
    }

    // Use default voice if not provided (George - British Male)
    const selectedVoiceId = voiceId || 'JBFqnCBsd6RMkjVDRZzb';

    console.log(`[Narration] Calling ElevenLabs API for slide ${slideNumber}...`);

    // Generate audio using ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: speakerNotes,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Narration] ElevenLabs API error for slide ${slideNumber}:`, response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    console.log(`[Narration] Audio generated successfully for slide ${slideNumber}`);

    // Convert audio to base64 using proper Deno encoding
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    console.log(`[Narration] Audio encoded for slide ${slideNumber}, size: ${base64Audio.length} chars`);

    return new Response(
      JSON.stringify({
        slideNumber,
        audioBase64: base64Audio,
        duration: Math.ceil(speakerNotes.split(' ').length / 2.5), // Estimate ~2.5 words per second
        text: speakerNotes
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Narration] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate narration' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
