import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      originalEmail, 
      translatedEmail, 
      englishReply, 
      translatedReply, 
      sourceLanguage, 
      targetLanguage 
    } = await req.json();

    if (!originalEmail || !translatedEmail || !englishReply || !translatedReply) {
      throw new Error('Missing required email content for quality assessment');
    }

    console.log('Starting email translation quality assessment...');

    // Step 1: Generate reverse translation (translated reply back to English)
    const reverseTranslationPrompt = `Translate the following ${targetLanguage} text back to English. Provide only the translation:

${translatedReply}`;

    const reverseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a professional medical translator. Translate accurately and preserve medical terminology.' },
          { role: 'user', content: reverseTranslationPrompt }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    const reverseData = await reverseResponse.json();
    let reverseTranslation = reverseData.choices[0].message.content.trim();
    
    // Remove surrounding quotes if present
    reverseTranslation = reverseTranslation.replace(/^["']|["']$/g, '');

    // Step 2: Comprehensive quality assessment
    const assessmentPrompt = `As a medical translation quality expert, assess this email translation chain for NHS GP communication:

ORIGINAL PATIENT EMAIL (${sourceLanguage}):
${originalEmail}

TRANSLATED TO ENGLISH:
${translatedEmail}

ENGLISH REPLY COMPOSED:
${englishReply}

TRANSLATED REPLY (${targetLanguage}):
${translatedReply}

REVERSE CHECK (translated reply back to English):
${reverseTranslation}

Assess the following and provide scores (0-100):

1. FORWARD ACCURACY: How well does the translated reply convey the English reply's meaning?
2. REVERSE ACCURACY: How closely does the reverse translation match the original English reply?
3. MEDICAL SAFETY: Are medical terms, instructions, and critical information preserved accurately?
4. CULTURAL APPROPRIATENESS: Is the translation culturally appropriate for NHS patient communication?
5. OVERALL SAFETY: Based on all factors, is this safe to send?

Also identify:
- Any medical terminology that may have been lost or mistranslated
- Cultural sensitivity issues
- Potential misunderstandings
- Whether this requires human review

Return a JSON response with:
{
  "forwardAccuracy": number (0-100),
  "reverseAccuracy": number (0-100),
  "medicalTermsPreserved": boolean,
  "culturalAppropriateness": number (0-100),
  "overallSafety": "safe" | "warning" | "unsafe",
  "issues": string[],
  "recommendation": string,
  "reverseTranslation": string
}

Scoring guidelines:
- 90-100: Excellent, safe for medical communication
- 80-89: Good, minor issues
- 70-79: Acceptable with review
- Below 70: Requires human translator review

For overallSafety:
- "safe": Accurate translation, safe to send
- "warning": Minor issues, recommend review  
- "unsafe": Significant issues, human review required`;

    const qualityResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'You are a medical translation quality expert for NHS services. Provide accurate, safety-focused assessments in valid JSON format.' 
          },
          { role: 'user', content: assessmentPrompt }
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    });

    if (!qualityResponse.ok) {
      const errorData = await qualityResponse.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const qualityData = await qualityResponse.json();
    let assessmentResult;

    try {
      const content = qualityData.choices[0].message.content.trim();
      // Extract JSON from the response (handle potential markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        assessmentResult = JSON.parse(jsonMatch[0]);
      } else {
        assessmentResult = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse quality assessment:', parseError);
      // Fallback assessment
      assessmentResult = {
        forwardAccuracy: 75,
        reverseAccuracy: 70,
        medicalTermsPreserved: true,
        culturalAppropriateness: 80,
        overallSafety: 'warning',
        issues: ['Unable to perform detailed assessment - please review manually'],
        recommendation: 'Manual review recommended due to assessment parsing error'
      };
    }

    // Ensure reverseTranslation is included
    assessmentResult.reverseTranslation = reverseTranslation;

    console.log('Quality assessment completed:', assessmentResult);

    return new Response(JSON.stringify(assessmentResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email translation quality assessment:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to assess email translation quality' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});