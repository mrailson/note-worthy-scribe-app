import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    console.log('Received TTS request, text length:', text?.length);
    
    if (!text) {
      throw new Error('Text is required');
    }

    // Deepgram TTS has a 2000 character limit
    const MAX_CHARS = 2000;
    let processedText = text;
    let wasTruncated = false;
    
    if (text.length > MAX_CHARS) {
      // Truncate at sentence boundary if possible
      const truncated = text.substring(0, MAX_CHARS);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastQuestion = truncated.lastIndexOf('?');
      const lastExclamation = truncated.lastIndexOf('!');
      const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
      
      if (lastSentenceEnd > MAX_CHARS * 0.8) {
        // If we found a sentence ending in the last 20%, use it
        processedText = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        // Otherwise just truncate at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        processedText = truncated.substring(0, lastSpace) + '...';
      }
      
      wasTruncated = true;
      console.log('Text truncated from', text.length, 'to', processedText.length, 'characters');
    }

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!deepgramApiKey) {
      console.error('DEEPGRAM_API_KEY not configured');
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    console.log('Calling Deepgram TTS API...');

    // Call Deepgram TTS API
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-draco-en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: processedText }),
    });

    console.log('Deepgram API response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Deepgram API error:', error);
      throw new Error(`Deepgram API error: ${response.status} - ${error}`);
    }

    // Get audio as array buffer
    const audioBuffer = await response.arrayBuffer();
    console.log('Audio buffer size:', audioBuffer.byteLength);
    
    // Convert to base64 (process in chunks to avoid stack overflow)
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = '';
    const chunkSize = 0x8000; // 32KB chunks
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binaryString);

    console.log('Successfully generated audio, base64 length:', base64Audio.length);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        wasTruncated,
        originalLength: text.length,
        processedLength: processedText.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Deepgram TTS error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
