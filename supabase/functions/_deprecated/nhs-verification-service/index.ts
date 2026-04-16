import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  originalPrompt: string;
  responses: Array<{
    model: string;
    response: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalPrompt, responses }: RequestBody = await req.json();

    console.log(`NHS Verification for prompt: ${originalPrompt.substring(0, 100)}...`);

    // Step A: Fetch NHS England page
    const nhsResponse = await fetch(
      'https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/'
    );

    if (!nhsResponse.ok) {
      throw new Error(`Failed to fetch NHS England page: ${nhsResponse.status}`);
    }

    const nhsHtml = await nhsResponse.text();

    // Step B: Use AI to analyze with NHS data
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an NHS England verification assistant. Your job is to verify AI responses against official NHS England guidance.

CRITICAL RULES:
1. Use ONLY the fetched NHS England HTML content provided
2. Paste eligibility criteria and programme dates VERBATIM from the source
3. Do not add your own interpretation
4. Show a clear verification verdict: "correct", "incorrect", or "partially correct"
5. Provide NHS England references/links

The NHS England HTML content is: ${nhsHtml.substring(0, 10000)}`;

    const userPrompt = `Verify these AI responses against NHS England guidance:

Original prompt: "${originalPrompt}"

AI Responses to verify:
${responses.map((r, i) => `${i + 1}. ${r.model}: ${r.response}`).join('\n\n')}

Please provide:
1. Verbatim eligibility criteria from NHS England
2. Verbatim programme dates from NHS England  
3. Verification verdict for each response
4. Corrected information if needed
5. NHS England reference links

Format as JSON with: eligibilityCriteria, programmeDates, verdict, explanation, references`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let verificationResult;

    try {
      verificationResult = JSON.parse(aiData.choices[0].message.content);
    } catch (parseError) {
      // If JSON parsing fails, return structured data
      const content = aiData.choices[0].message.content;
      verificationResult = {
        eligibilityCriteria: content.includes('eligibility') ? content.split('eligibility')[1].split('\n')[0] : 'Could not extract eligibility criteria',
        programmeDates: content.includes('programme') ? content.split('programme')[1].split('\n')[0] : 'Could not extract programme dates',
        verdict: content.toLowerCase().includes('correct') ? 'correct' : 'needs_review',
        explanation: content,
        references: ['https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/']
      };
    }

    console.log('NHS verification completed successfully');

    return new Response(JSON.stringify(verificationResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in NHS verification service:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});