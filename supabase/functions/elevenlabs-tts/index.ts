import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preprocess text for better TTS pronunciation
function preprocessTextForTTS(text: string): string {
  let processed = text;
  
  // Convert currency amounts with M (millions) and K (thousands)
  processed = processed.replace(/£(\d+\.?\d*)\s*million/gi, (match, num) => {
    return `${num} million pounds`;
  });
  
  processed = processed.replace(/£(\d+\.?\d*)M\b/g, (match, num) => {
    const spoken = parseFloat(num) === 1 ? 'one million pounds' : `${num} million pounds`;
    return spoken;
  });
  
  processed = processed.replace(/£(\d+\.?\d*)K\b/g, (match, num) => {
    const spoken = parseFloat(num) === 1 ? 'one thousand pounds' : `${num} thousand pounds`;
    return spoken;
  });
  
  // Convert regular currency amounts (£123,456.78 or £123456.78)
  processed = processed.replace(/£([\d,]+\.?\d*)/g, (match, num) => {
    const cleanNum = num.replace(/,/g, '');
    const numValue = parseFloat(cleanNum);
    
    if (numValue >= 1000000) {
      const millions = (numValue / 1000000).toFixed(2).replace(/\.?0+$/, '');
      return `${millions} million pounds`;
    } else if (numValue >= 1000) {
      const thousands = (numValue / 1000).toFixed(1).replace(/\.?0+$/, '');
      return `${thousands} thousand pounds`;
    } else {
      return `${cleanNum} pounds`;
    }
  });
  
  // Convert standalone £ symbol
  processed = processed.replace(/£/g, 'pounds');
  
  // Convert large numbers with commas for better pronunciation
  processed = processed.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (match, num) => {
    return num.replace(/,/g, '');
  });
  
  // Convert percentages
  processed = processed.replace(/(\d+\.?\d*)%/g, '$1 percent');
  
  // Convert dates (1st, 2nd, 3rd, 4th, etc.)
  processed = processed.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num, suffix) => {
    return `${num}${suffix.toLowerCase()}`;
  });
  
  return processed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voiceId = '9BWtsMINqrJLrRacOk9x' } = await req.json();
    
    console.log('Received ElevenLabs TTS request, text length:', text?.length, 'voiceId:', voiceId);
    
    if (!text) {
      throw new Error('Text is required');
    }

    // Preprocess text for better TTS pronunciation
    const processedText = preprocessTextForTTS(text);
    console.log('Text preprocessed for TTS, original length:', text.length, 'processed length:', processedText.length);

    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!elevenlabsApiKey) {
      console.error('ELEVENLABS_API_KEY not configured');
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    console.log('Calling ElevenLabs TTS API...');

    // Call ElevenLabs TTS API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: processedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    console.log('ElevenLabs API response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
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
        wasTruncated: false,
        originalLength: text.length,
        processedLength: text.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
