import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    const { content, voiceProvider, voiceId, targetDuration, mode = 'full', text, previewLength, scriptStyle = 'executive', customDirections } = await req.json();

    console.log('Request params:', { mode, voiceId, hasContent: !!content, hasText: !!text, previewLength, hasCustomDirections: !!customDirections });

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

      // Style-specific system prompts
      const stylePrompts: Record<string, string> = {
        executive: `You are creating an executive audio briefing. Focus on:
- Key strategic points and business impact
- High-level decisions and outcomes
- Critical metrics and performance indicators
- Actionable insights for leadership
Use confident, authoritative language suitable for senior stakeholders.`,
        
        training: `You are creating educational audio content. Focus on:
- Clear, step-by-step explanations
- Define technical terms when first used
- Use examples and analogies
- Summarise key learning points
Maintain an encouraging, instructive tone.`,
        
        meeting: `You are creating a meeting recap audio. Focus on:
- Key discussion points and context
- Decisions made and their rationale
- Action items and owners
- Next steps and deadlines
Keep it concise and factual.`,
        
        podcast: `You are creating an engaging podcast segment. Focus on:
- Conversational, friendly tone
- Storytelling elements and flow
- Thought-provoking insights
- Natural transitions between topics
Make it interesting and easy to listen to.`,
        
        technical: `You are creating a technical briefing audio. Focus on:
- Precise terminology and accuracy
- Detailed technical information
- Process and methodology explanations
- Specifications and data points
Use formal, professional language.`,
        
        patient: `You are creating patient-friendly audio content. Focus on:
- Clear, jargon-free language
- Empathetic and reassuring tone
- Practical guidance and next steps
- Important information repeated for clarity
Ensure accessibility for all understanding levels.`
      };

      const systemPrompt = stylePrompts[scriptStyle] || stylePrompts.executive;
      const targetWords = (targetDuration || 180) * 2.5; // ~2.5 words per second
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-lite-preview',
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}

${customDirections ? `
ADDITIONAL USER DIRECTIONS:
${customDirections}

Please incorporate these specific directions into your narration while maintaining the overall style.
` : ''}
Create a natural, conversational summary that sounds great when spoken aloud.
Target length: approximately ${targetWords} words.
Use clear transitions and maintain an appropriate tone throughout.
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

    console.log('Fetching audio from ElevenLabs...');
    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('Received audio buffer, size (bytes):', audioBuffer.byteLength);

    // Upload preview audio to existing meeting-audio-overviews bucket for reliable playback
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase storage environment not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const timestamp = Date.now();
    const safeVoiceId = voiceId || 'unknown-voice';
    const filePath = `document-previews/${safeVoiceId}/${timestamp}.mp3`;

    const uint8Audio = new Uint8Array(audioBuffer);

    console.log('Uploading preview audio to storage at path:', filePath);
    const { error: uploadError } = await supabase.storage
      .from('meeting-audio-overviews')
      .upload(filePath, uint8Audio, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '0',
      });

    if (uploadError) {
      console.error('Error uploading preview audio:', uploadError);
      throw new Error('Failed to upload preview audio');
    }

    const { data: urlData } = supabase.storage
      .from('meeting-audio-overviews')
      .getPublicUrl(filePath);

    const audioUrl = `${urlData.publicUrl}?v=${Date.now()}`;
    console.log('Preview audio URL:', audioUrl);

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
