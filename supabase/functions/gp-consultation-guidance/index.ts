import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  transcript: string;
  consultationType?: string;
}

interface GuidanceResponse {
  suggestedQuestions: string[];
  potentialRedFlags: string[];
  missedOpportunities: string[];
  safetyNetting: string[];
  consultationQuality: {
    score: number;
    feedback: string;
  };
}

const analyzeConsultation = async (transcript: string, consultationType?: string): Promise<GuidanceResponse> => {
  const prompt = `You are a senior GP providing real-time consultation guidance. Analyze this ongoing GP consultation transcript and provide structured feedback to help ensure a high-quality, safe consultation.

Current transcript:
"""
${transcript}
"""

Provide your analysis in the following JSON format:
{
  "suggestedQuestions": [
    "List 3-5 specific questions the GP should consider asking based on what's been discussed so far"
  ],
  "potentialRedFlags": [
    "List any potential red flag symptoms or signs that should be explored further"
  ],
  "missedOpportunities": [
    "List any important areas that may have been missed (history taking, examination, safety netting)"
  ],
  "safetyNetting": [
    "List specific safety netting advice that should be provided to the patient"
  ],
  "consultationQuality": {
    "score": 85,
    "feedback": "Brief assessment of consultation quality so far with specific suggestions for improvement"
  }
}

Focus on:
1. Clinical safety and risk assessment
2. Completeness of history and examination
3. Patient-centered care and communication
4. Appropriate investigation and management
5. Safety netting and follow-up

Consider common consultation frameworks like:
- Calgary-Cambridge consultation model
- ICE (Ideas, Concerns, Expectations)
- SOCRATES for pain assessment
- Systems review for presenting complaints

Be practical and specific in your suggestions. Assume this is an ongoing consultation that can still be improved.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior GP mentor providing real-time guidance during consultations. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse JSON response:', content);
    throw new Error('Invalid JSON response from AI');
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, consultationType }: RequestBody = await req.json();

    if (!transcript || transcript.trim().length < 20) {
      // Return minimal guidance for very short transcripts
      return new Response(JSON.stringify({
        suggestedQuestions: ["Establish the presenting complaint in the patient's own words"],
        potentialRedFlags: [],
        missedOpportunities: ["Initial greeting and rapport building"],
        safetyNetting: [],
        consultationQuality: {
          score: 0,
          feedback: "Consultation just starting - ensure clear introduction and establish rapport"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing transcript length:', transcript.length);
    console.log('Consultation type:', consultationType);

    const guidance = await analyzeConsultation(transcript, consultationType);

    console.log('Generated guidance successfully');

    return new Response(JSON.stringify(guidance), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in GP consultation guidance:', error);
    
    // Fallback response
    const fallbackGuidance: GuidanceResponse = {
      suggestedQuestions: [
        "Can you tell me more about your main concern today?",
        "How long have you been experiencing these symptoms?",
        "Is there anything that makes it better or worse?"
      ],
      potentialRedFlags: [
        "Always consider red flag symptoms for the presenting complaint"
      ],
      missedOpportunities: [
        "Ensure systematic history taking",
        "Consider patient's ideas, concerns and expectations"
      ],
      safetyNetting: [
        "Provide clear advice on when to seek further help"
      ],
      consultationQuality: {
        score: 50,
        feedback: "Unable to analyze consultation - ensure thorough history and examination"
      }
    };

    return new Response(JSON.stringify(fallbackGuidance), {
      status: 200, // Return 200 with fallback guidance rather than error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});