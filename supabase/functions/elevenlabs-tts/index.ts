import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── NHS Primary Care Pronunciation Rules ──────────────────────────────
// Deterministic text replacements so ElevenLabs speaks UK NHS acronyms
// naturally. Applied once, immediately before synthesis.
// To add a term: append { match: '\\bACRONYM\\b', say: 'phonetic hint' }.
const NHS_PRONUNCIATION_RULES: Array<{ match: string; say: string }> = [
  // Organisations & Structures
  { match: '\\bAPMS\\b',      say: 'ay pee em ess' },
  { match: '\\bCQC\\b',       say: 'see cue see' },
  { match: '\\bGMS\\b',       say: 'jee em ess' },
  { match: '\\bICB\\b',       say: 'I C B' },
  { match: '\\bICS\\b',       say: 'I C S' },
  { match: '\\bNHSE\\b',      say: 'N H S E' },
  { match: '\\bPCN\\b',       say: 'P C N' },
  { match: '\\bPMS\\b',       say: 'pee em ess' },
  // Workforce & Contracts
  { match: '\\bARRS\\b',      say: 'ah-riss' },
  { match: '\\bDES\\b',       say: 'D E S' },
  { match: '\\bLES\\b',       say: 'L E S' },
  { match: '\\bQOF\\b',       say: 'kwoff' },
  { match: '\\bTUPE\\b',      say: 'too-pee' },
  // Clinical Systems
  { match: '\\bEMIS\\b',      say: 'ee-miss' },
  { match: '\\bSNOMED\\b',    say: 'snow-med' },
  { match: '\\bSystmOne\\b',  say: 'system one' },
  { match: '\\bTPP\\b',       say: 'T P P' },
  // Clinical Acronyms
  { match: '\\bBNF\\b',       say: 'B N F' },
  { match: '\\bDMARD\\b',     say: 'dee-mard' },
  { match: '\\bDMARDs\\b',    say: 'dee-mards' },
  { match: '\\bDNACPR\\b',    say: 'dee en ay see pee are' },
  { match: '\\bEHCP\\b',      say: 'E H C P' },
  { match: '\\bGDPR\\b',      say: 'G D P R' },
  { match: '\\bHCA\\b',       say: 'H C A' },
  { match: '\\bIIF\\b',       say: 'I I F' },
  { match: '\\bMDT\\b',       say: 'M D T' },
  { match: '\\bSSP\\b',       say: 'S S P' },
];

function applyNHSPronunciation(text: string): string {
  let result = text;
  for (const rule of NHS_PRONUNCIATION_RULES) {
    result = result.replace(new RegExp(rule.match, 'g'), rule.say);
  }
  return result;
}

// Preprocess text for better TTS pronunciation
function preprocessTextForTTS(text: string): string {
  let processed = text;
  
  // Helper function to spell out decimal digits
  const spellOutDecimal = (decimalPart: string): string => {
    return decimalPart.split('').join(' ');
  };
  
  // Helper function to convert numbers to words for better pronunciation
  const numberToWords = (num: number): string => {
    if (num === 0) return 'zero';
    if (num < 0) return 'minus ' + numberToWords(-num);
    
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
    }
    if (num < 1000) {
      const hundred = Math.floor(num / 100);
      const rest = num % 100;
      return ones[hundred] + ' hundred' + (rest > 0 ? ' and ' + numberToWords(rest) : '');
    }
    return num.toString(); // fallback for larger numbers
  };
  
  // Convert currency amounts with M (millions) - handle decimal points properly
  processed = processed.replace(/£(\d+)\.(\d+)\s*M(?:illion)?/gi, (match, whole, decimal) => {
    const decimalSpelled = spellOutDecimal(decimal);
    return `${whole} point ${decimalSpelled} million pounds sterling`;
  });
  
  processed = processed.replace(/£(\d+)\s*M(?:illion)?/gi, (match, num) => {
    return `${num} million pounds sterling`;
  });
  
  // Convert currency amounts with K (thousands)
  processed = processed.replace(/£(\d+)\.(\d+)K/gi, (match, whole, decimal) => {
    const decimalSpelled = spellOutDecimal(decimal);
    return `${whole} point ${decimalSpelled} thousand pounds sterling`;
  });
  
  processed = processed.replace(/£(\d+)K/gi, (match, num) => {
    return `${num} thousand pounds sterling`;
  });
  
  // Convert regular currency amounts with pence (£26.33)
  processed = processed.replace(/£([\d,]+)\.(\d{2})\b/g, (match, pounds, pence) => {
    const cleanPounds = pounds.replace(/,/g, '');
    const poundsNum = parseInt(cleanPounds);
    const penceNum = parseInt(pence);
    
    if (penceNum === 0) {
      if (poundsNum >= 1000) {
        const thousands = Math.floor(poundsNum / 1000);
        const remainder = poundsNum % 1000;
        if (remainder === 0) {
          return `${thousands} thousand pounds sterling`;
        }
        return `${thousands} thousand and ${numberToWords(remainder)} pounds sterling`;
      }
      return `${cleanPounds} pounds sterling`;
    }
    
    let poundsText = cleanPounds;
    if (poundsNum >= 1000) {
      const thousands = Math.floor(poundsNum / 1000);
      const remainder = poundsNum % 1000;
      if (remainder === 0) {
        poundsText = `${thousands} thousand`;
      } else {
        poundsText = `${thousands} thousand and ${numberToWords(remainder)}`;
      }
    }
    
    return `${poundsText} pounds and ${numberToWords(penceNum)} pence`;
  });
  
  // Convert regular currency amounts without pence (£146,442 or £2,340,567)
  processed = processed.replace(/£([\d,]+)\b/g, (match, num) => {
    const cleanNum = num.replace(/,/g, '');
    const numValue = parseInt(cleanNum);
    
    if (numValue >= 1000000) {
      const millions = Math.floor(numValue / 1000000);
      const remainder = numValue % 1000000;
      if (remainder === 0) {
        return `${millions} million pounds sterling`;
      }
      const thousands = Math.floor(remainder / 1000);
      const ones = remainder % 1000;
      if (thousands === 0 && ones > 0) {
        return `${millions} million and ${numberToWords(ones)} pounds sterling`;
      } else if (thousands > 0 && ones === 0) {
        return `${millions} million and ${thousands} thousand pounds sterling`;
      } else if (thousands > 0 && ones > 0) {
        return `${millions} million, ${thousands} thousand and ${numberToWords(ones)} pounds sterling`;
      }
      return `${millions} million pounds sterling`;
    } else if (numValue >= 1000) {
      const thousands = Math.floor(numValue / 1000);
      const remainder = numValue % 1000;
      if (remainder === 0) {
        return `${thousands} thousand pounds sterling`;
      }
      return `${thousands} thousand and ${numberToWords(remainder)} pounds sterling`;
    }
    
    return `${cleanNum} pounds sterling`;
  });
  
  // Convert standalone £ symbol
  processed = processed.replace(/£/g, 'pounds sterling');
  
  // Convert large numbers with commas (8,039 -> eight thousand and thirty-nine)
  processed = processed.replace(/\b(\d{1,3}),(\d{3})\b/g, (match, thousands, remainder) => {
    const thousandsNum = parseInt(thousands);
    const remainderNum = parseInt(remainder);
    if (remainderNum === 0) {
      return `${thousandsNum} thousand`;
    }
    return `${thousandsNum} thousand and ${numberToWords(remainderNum)}`;
  });
  
  // Convert decimal numbers (2.34 -> two point three four)
  processed = processed.replace(/\b(\d+)\.(\d+)\b/g, (match, whole, decimal) => {
    const decimalSpelled = spellOutDecimal(decimal);
    return `${whole} point ${decimalSpelled}`;
  });
  
  // Convert percentages
  processed = processed.replace(/(\d+)\.(\d+)%/g, (match, whole, decimal) => {
    const decimalSpelled = spellOutDecimal(decimal);
    return `${whole} point ${decimalSpelled} percent`;
  });
  
  processed = processed.replace(/(\d+)%/g, '$1 percent');
  
  // Convert dates (1st, 2nd, 3rd, 4th, etc.)
  processed = processed.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num, suffix) => {
    return `${num}${suffix.toLowerCase()}`;
  });
  
  // Apply NHS acronym pronunciation normalisation
  processed = applyNHSPronunciation(processed);
  
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
