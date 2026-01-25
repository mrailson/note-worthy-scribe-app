import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// OFFENSIVE LANGUAGE FILTER
// =============================================================================

// Severe terms - translation will be BLOCKED
const BLOCKED_TERMS = [
  // Severe profanity (English)
  'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'motherfucking',
  'cunt', 'cunts',
  'nigger', 'nigga', 'niggas',
  'faggot', 'fag', 'faggots',
  'retard', 'retarded',
  'spastic', 'spaz',
  // Slurs and hate speech
  'kike', 'chink', 'gook', 'wetback', 'beaner', 'spic',
  'paki', 'pakis',
  'tranny', 'shemale',
  // Threats
  'kill you', 'kill yourself', 'kys',
];

// Mild terms - translation proceeds with WARNING
const WARNING_TERMS = [
  'shit', 'shitty', 'bullshit',
  'damn', 'damned', 'dammit',
  'bloody', 'bugger', 'bollocks',
  'arse', 'arsehole', 'ass', 'asshole',
  'bitch', 'bitches', 'bitchy',
  'bastard', 'bastards',
  'piss', 'pissed', 'pissing',
  'crap', 'crappy',
  'sod', 'sodding',
  'wanker', 'wankers',
  'twat', 'twats',
  'dick', 'dickhead',
  'idiot', 'idiots', 'idiotic',
  'stupid', 'moron', 'imbecile',
];

interface ContentCheckResult {
  status: 'safe' | 'warning' | 'blocked';
  flaggedTerms: string[];
  reason?: string;
}

function checkOffensiveContent(text: string): ContentCheckResult {
  const lowerText = text.toLowerCase();
  
  // Check for blocked content (severe)
  const blockedMatches = BLOCKED_TERMS.filter(term => {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });
  
  if (blockedMatches.length > 0) {
    console.log('🚫 Content BLOCKED - matched terms:', blockedMatches);
    return {
      status: 'blocked',
      flaggedTerms: blockedMatches,
      reason: 'Content contains language that cannot be translated in a healthcare setting'
    };
  }
  
  // Check for warning content (mild)
  const warningMatches = WARNING_TERMS.filter(term => {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });
  
  if (warningMatches.length > 0) {
    console.log('⚠️ Content WARNING - matched terms:', warningMatches);
    return {
      status: 'warning',
      flaggedTerms: warningMatches,
      reason: 'Content may contain inappropriate language'
    };
  }
  
  return { status: 'safe', flaggedTerms: [] };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TRANSLATE-TEXT FUNCTION START ===');
    
    // Try multiple ways to access the API key
    let GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    
    // Also try these alternative names that might be used
    if (!GOOGLE_TRANSLATE_API_KEY) {
      GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    }
    if (!GOOGLE_TRANSLATE_API_KEY) {
      GOOGLE_TRANSLATE_API_KEY = Deno.env.get('TRANSLATE_API_KEY');
    }
    
    // Check if we can access environment variables at all
    const allEnvKeys = Object.keys(Deno.env.toObject());
    console.log('All available env keys:', allEnvKeys);
    console.log('Google-related keys:', allEnvKeys.filter(key => key.toLowerCase().includes('google')));
    console.log('Translate-related keys:', allEnvKeys.filter(key => key.toLowerCase().includes('translate')));
    
    console.log('API Key status:', GOOGLE_TRANSLATE_API_KEY ? `Found (length: ${GOOGLE_TRANSLATE_API_KEY.length})` : 'Not found');
    
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.error('Google Translate API key not found in environment');
      return new Response(
        JSON.stringify({ 
          error: 'Google Translate API key not configured. Please add GOOGLE_TRANSLATE_API_KEY secret.',
          debug: {
            availableEnvKeys: allEnvKeys,
            googleKeys: allEnvKeys.filter(key => key.toLowerCase().includes('google')),
            translateKeys: allEnvKeys.filter(key => key.toLowerCase().includes('translate'))
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { text, targetLanguage, sourceLanguage } = await req.json();
    const normalisedSourceLanguage =
      sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : undefined;

    console.log('Translation request:', {
      text: text?.substring(0, 50),
      targetLanguage,
      sourceLanguage: normalisedSourceLanguage ?? '(auto)',
    });

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Text and target language are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==========================================================================
    // OFFENSIVE LANGUAGE CHECK
    // ==========================================================================
    const contentCheck = checkOffensiveContent(text);
    
    if (contentCheck.status === 'blocked') {
      console.warn('🚫 Translation BLOCKED - offensive content detected:', contentCheck.flaggedTerms);
      return new Response(
        JSON.stringify({
          error: 'Content cannot be translated',
          blocked: true,
          reason: contentCheck.reason,
          flaggedTerms: contentCheck.flaggedTerms
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use Google Translate API v2 with neural machine translation
    console.log('Calling Google Translate API...');
    const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    console.log('API URL (without key):', apiUrl.replace(GOOGLE_TRANSLATE_API_KEY, '[REDACTED]'));

    const requestBody: Record<string, unknown> = {
      q: text,
      target: targetLanguage,
      format: 'text',
      model: 'nmt', // Neural Machine Translation
    };

    // If source language is not provided, Google will auto-detect.
    if (normalisedSourceLanguage) {
      requestBody.source = normalisedSourceLanguage;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Google Translate API response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Translate API error response:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Translation API error: ${errorText}`,
          status: response.status,
          debug: {
            responseStatus: response.status,
            responseHeaders: Object.fromEntries(response.headers.entries())
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('Translation successful, response keys:', Object.keys(data));
    const translatedText = data.data.translations[0].translatedText;

    // Include content warning if mild profanity was detected
    const responsePayload: Record<string, unknown> = {
      translatedText,
      sourceLanguage: data.data.translations[0].detectedSourceLanguage || normalisedSourceLanguage || 'unknown',
      targetLanguage,
    };

    if (contentCheck.status === 'warning') {
      responsePayload.contentWarning = {
        reason: contentCheck.reason,
        flaggedTerms: contentCheck.flaggedTerms
      };
    }

    return new Response(
      JSON.stringify(responsePayload),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Translation error caught:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown translation error',
        debug: {
          errorName: error?.name,
          errorStack: error?.stack?.split('\n').slice(0, 3).join('\n')
        }
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});