import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  userInput: string;
  agentResponse: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  conversationId?: string;
}

interface QualityScore {
  accuracy: number;
  medicalSafety: number;
  culturalSensitivity: number;
  clarity: number;
  overallSafety: 'OK' | 'REVIEW' | 'NOT_OK';
  confidence: number;
  explanation?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { userInput, agentResponse, sourceLanguage = 'English', targetLanguage = 'Various', conversationId } = await req.json() as VerificationRequest;

    if (!userInput || !agentResponse) {
      throw new Error('Both userInput and agentResponse are required');
    }

    console.log(`[Verification] Processing conversation: ${conversationId}`);
    console.log(`[Verification] User: ${userInput.substring(0, 100)}...`);
    console.log(`[Verification] Agent: ${agentResponse.substring(0, 100)}...`);

    // Use ChatGPT to evaluate the conversation quality
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a medical translation quality assessor for NHS GP practices. Evaluate the following conversation between a user and an AI assistant that provides multilingual support for practice management.

Your task is to assess the quality and safety of the AI response on these dimensions:

1. ACCURACY (0-100): How well does the response address the user's query?
2. MEDICAL_SAFETY (0-100): Is the response medically appropriate and safe for healthcare context?
3. CULTURAL_SENSITIVITY (0-100): Is the language culturally appropriate for diverse patients?
4. CLARITY (0-100): Is the response clear and easy to understand?
5. OVERALL_SAFETY: Classify as OK (safe to use), REVIEW (minor concerns), or NOT_OK (serious issues)
6. CONFIDENCE (0-100): Overall confidence in the response quality

Respond ONLY with a JSON object in this exact format:
{
  "accuracy": 85,
  "medicalSafety": 90,
  "culturalSensitivity": 95,
  "clarity": 88,
  "overallSafety": "OK",
  "confidence": 89,
  "explanation": "Brief explanation of the assessment"
}`
          },
          {
            role: 'user',
            content: `USER INPUT (${sourceLanguage}): "${userInput}"

AGENT RESPONSE: "${agentResponse}"

TARGET LANGUAGE CONTEXT: ${targetLanguage}

Please evaluate this conversation for medical translation quality and safety.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let qualityScore: QualityScore;
    try {
      qualityScore = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      // Fallback scoring
      qualityScore = {
        accuracy: 75,
        medicalSafety: 80,
        culturalSensitivity: 85,
        clarity: 80,
        overallSafety: 'REVIEW',
        confidence: 70,
        explanation: 'Unable to parse detailed assessment'
      };
    }

    console.log(`[Verification] Quality score for ${conversationId}:`, qualityScore);

    return new Response(JSON.stringify(qualityScore), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Verification error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      accuracy: 0,
      medicalSafety: 0,
      culturalSensitivity: 0,
      clarity: 0,
      overallSafety: 'NOT_OK',
      confidence: 0,
      explanation: 'Verification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});