import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to base64 in chunks
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time
  let binary = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, voiceProvider, voiceId, targetDuration, mode = 'full', text, previewLength } = await req.json();

    console.log('Request params:', { mode, voiceId, hasContent: !!content, hasText: !!text, previewLength });

    // Validate inputs based on mode
    if (mode === 'script-only' || mode === 'full') {
      if (!content || !content.trim()) {
        throw new Error('Content is required');
      }
    }
    
    if (mode === 'audio-only' || mode === 'full') {
      if (!voiceId) {
        throw new Error('Voice ID is required for audio generation');
      }
    }
    
    if (mode === 'audio-only') {
      if (!text || !text.trim()) {
        throw new Error('Text is required for audio-only mode');
      }
    }

    let narrativeText = '';

    // Step 1: Generate narrative text using AI (if needed)
    if (mode === 'script-only' || mode === 'full') {
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableApiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const targetWords = (targetDuration || 180) * 2.5; // ~2.5 words per second
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a professional narrator creating an engaging audio overview. 
              Create a natural, conversational summary that sounds great when spoken aloud.
              Target length: approximately ${targetWords} words.
              Use clear transitions and maintain an engaging tone throughout.
              IMPORTANT: Write only spoken words - NO stage directions, sound effects, music cues, or script notations like "(music fades in)". 
              Just write the actual narrative text that should be spoken.`
            },
            {
              role: 'user',
              content: `Create an audio overview of the following content:\n\n${content.substring(0, 50000)}`
            }
          ],
          temperature: 0.8,
          max_completion_tokens: Math.ceil(targetWords * 1.5)
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Credits exhausted. Please add credits to your Lovable workspace.');
        }
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      narrativeText = aiData.choices?.[0]?.message?.content || content.substring(0, 1000);

      // If script-only mode, return just the script
      if (mode === 'script-only') {
        return new Response(
          JSON.stringify({
            narrativeText,
            wordCount: narrativeText.split(' ').length,
            duration: Math.ceil(narrativeText.split(' ').length / 2.5)
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (mode === 'audio-only') {
      narrativeText = text;
    }

    // Apply preview length if specified
    if (previewLength) {
      const words = narrativeText.split(' ');
      narrativeText = words.slice(0, previewLength).join(' ');
    }

    // Step 2: Generate audio using ElevenLabs
    const elevenLabsKey = Deno.env.get('ELEVEN_LABS_API_KEY');
    if (!elevenLabsKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('Generating audio with voice:', voiceId, 'Text length:', narrativeText.length);

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: narrativeText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs API error:', ttsResponse.status, errorText);
      throw new Error(`Text-to-speech generation failed: ${ttsResponse.status}`);
    }

    console.log('Converting audio to base64...');
    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('Audio buffer size:', audioBuffer.byteLength, 'bytes');
    
    // Convert audio to base64 using chunked processing to avoid stack overflow
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
    console.log('Audio conversion complete');

    const estimatedDuration = Math.ceil(narrativeText.split(' ').length / 2.5);

    return new Response(
      JSON.stringify({
        audioUrl,
        narrativeText,
        duration: estimatedDuration,
        wordCount: narrativeText.split(' ').length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in generate-document-audio-overview:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate audio overview' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
