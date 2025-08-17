import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  originalPrompt: string;
  previousAnswer: string;
  model: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalPrompt, previousAnswer, model }: RequestBody = await req.json();

    console.log(`Challenge & Verify for model: ${model}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an AI response verification and correction system. Your job is to analyze AI responses and provide verification with corrections if needed.

INSTRUCTIONS:
1. Analyze the original prompt and the AI's response
2. Determine if the response is correct, appropriate, and complete
3. If incorrect, provide a corrected version
4. Give a confidence score (0.0 to 1.0)
5. Explain your analysis

For simple tests like "Reply with PONG", check if the AI followed the instruction exactly.
For complex queries, verify factual accuracy, completeness, and appropriateness.

Always respond in valid JSON format with these fields:
- originalResponse: string
- isCorrect: boolean
- analysis: string
- correctedAnswer: string (if correction needed, otherwise null)
- confidence: number (0.0 to 1.0)
- recommendations: string[]`;

    const userPrompt = `Verify and potentially correct this AI response:

Original Prompt: "${originalPrompt}"
AI Model: ${model}
AI Response: "${previousAnswer}"

Please analyze this response and provide verification in JSON format.`;

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
        max_tokens: 1000,
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
      // If JSON parsing fails, create structured response
      const content = aiData.choices[0].message.content;
      verificationResult = {
        originalResponse: previousAnswer,
        isCorrect: content.toLowerCase().includes('correct'),
        analysis: content,
        correctedAnswer: content.toLowerCase().includes('incorrect') ? 'Response needs correction - see analysis' : null,
        confidence: 0.8,
        recommendations: ['Review the analysis for detailed feedback']
      };
    }

    // Ensure we have the original response
    verificationResult.originalResponse = previousAnswer;

    console.log(`Challenge & Verify completed for ${model}`);

    return new Response(JSON.stringify(verificationResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Challenge & Verify service:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false,
      originalResponse: '',
      isCorrect: false,
      analysis: 'Error occurred during verification',
      correctedAnswer: null,
      confidence: 0.0,
      recommendations: ['Retry the verification']
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});