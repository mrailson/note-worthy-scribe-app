import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preprocess text for better TTS pronunciation
function preprocessTextForTTS(text: string): string {
  let processed = text;
  
  // Convert currency amounts with M (millions) - handle decimal points
  processed = processed.replace(/£(\d+\.?\d*)\s*million/gi, (match, num) => {
    const parts = num.split('.');
    if (parts.length > 1 && parts[1] !== '0') {
      return `${num} million pounds sterling`;
    }
    return `${num} million pounds sterling`;
  });
  
  processed = processed.replace(/£(\d+\.?\d*)M\b/g, (match, num) => {
    return `${num} million pounds sterling`;
  });
  
  processed = processed.replace(/£(\d+\.?\d*)K\b/g, (match, num) => {
    return `${num} thousand pounds sterling`;
  });
  
  // Convert regular currency amounts with pence (£26.33)
  processed = processed.replace(/£([\d,]+)\.(\d{2})\b/g, (match, pounds, pence) => {
    const cleanPounds = pounds.replace(/,/g, '');
    const penceNum = parseInt(pence);
    
    if (penceNum === 0) {
      return `${cleanPounds} pounds sterling`;
    }
    return `${cleanPounds} pounds and ${pence} pence`;
  });
  
  // Convert regular currency amounts without pence (£146,442 or £2.4)
  processed = processed.replace(/£([\d,]+\.?\d*)\b/g, (match, num) => {
    const cleanNum = num.replace(/,/g, '');
    const numValue = parseFloat(cleanNum);
    
    if (numValue >= 1000000) {
      const millions = (numValue / 1000000).toFixed(1).replace(/\.0$/, '');
      return `${millions} million pounds sterling`;
    } else if (numValue >= 1000) {
      // For numbers like 146442, say "146 thousand 442 pounds" (NO comma in output)
      const thousands = Math.floor(numValue / 1000);
      const remainder = Math.round(numValue % 1000);
      if (remainder === 0) {
        return `${thousands} thousand pounds sterling`;
      }
      return `${thousands} thousand ${remainder} pounds sterling`;
    } else if (numValue < 1000 && numValue >= 100) {
      return `${cleanNum} pounds sterling`;
    } else {
      return `${cleanNum} pounds sterling`;
    }
  });
  
  // Convert standalone £ symbol
  processed = processed.replace(/£/g, 'pounds sterling');
  
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

    // Prepend a short announcer line to absorb initial audio instability
    const prefix = 'Notewell AI Meeting Summary:';
    const withPrefix = (typeof text === 'string' && text.trim().startsWith(prefix)) ? text : `${prefix} ${text}`;

    // Preprocess text for better TTS pronunciation
    const processedText = preprocessTextForTTS(withPrefix);
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
