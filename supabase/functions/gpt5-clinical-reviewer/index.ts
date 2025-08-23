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
    const { modelOutput, goldStandard, queryTitle } = await req.json();

    console.log('🔍 GPT-5 Clinical Reviewer started');
    console.log(`📋 Query: ${queryTitle}`);
    console.log(`📝 Model Output Length: ${modelOutput.length} characters`);
    console.log(`🏆 Gold Standard Length: ${goldStandard.length} characters`);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!modelOutput || !goldStandard) {
      throw new Error('Both modelOutput and goldStandard are required');
    }

    const reviewPrompt = `You are an expert NHS clinical reviewer evaluating AI-generated clinical advice quality.

TASK: Compare the AI model output against the gold standard NHS clinical guidance and provide a detailed evaluation.

GOLD STANDARD (UK NHS Approved Response):
"""
${goldStandard}
"""

AI MODEL OUTPUT TO REVIEW:
"""
${modelOutput}
"""

EVALUATION CRITERIA:
1. Clinical accuracy and completeness
2. Adherence to UK NHS guidelines (NICE, BNF, MHRA)
3. Presence of required sections and dosing information
4. Safety information and contraindications
5. Appropriate clinical terminology and structure
6. Citation of UK sources

SCORING GUIDE:
- 85-99: Excellent - Comprehensive, accurate, follows UK guidelines perfectly
- 70-84: Good - Accurate with minor gaps or formatting issues
- 50-69: Adequate - Generally correct but missing important elements
- 30-49: Poor - Significant gaps, inaccuracies, or safety concerns
- 0-29: Dangerous - Major clinical errors, unsafe advice, or completely wrong

RISK CLASSIFICATION:
- GREEN (Safe): 70-99 - Clinically sound advice
- ORANGE (Caution): 50-69 - Missing elements but not dangerous
- RED (Unsafe): 0-49 - Clinical concerns or safety issues

Provide your response in this exact JSON format:
{
  "confidenceScore": [number 0-99],
  "riskLevel": "[GREEN|ORANGE|RED]",
  "overallAssessment": "[2-3 sentence summary]",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "missingSections": ["missing section 1", "missing section 2"],
  "clinicalAccuracy": "[Excellent|Good|Adequate|Poor|Dangerous]",
  "nhsCompliance": "[Fully Compliant|Mostly Compliant|Partially Compliant|Non-Compliant]",
  "safetyRating": "[Very Safe|Safe|Moderate Risk|High Risk|Dangerous]"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert NHS clinical reviewer. Provide thorough, accurate evaluations in the exact JSON format requested. Be precise with scoring and risk assessment.' 
          },
          { role: 'user', content: reviewPrompt }
        ],
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reviewContent = data.choices[0].message.content;
    
    console.log('📊 GPT-5 Review Generated');

    // Parse the JSON response
    let reviewResult;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = reviewContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.log('Raw response:', reviewContent);
      
      // Fallback evaluation if JSON parsing fails
      reviewResult = {
        confidenceScore: 50,
        riskLevel: "ORANGE",
        overallAssessment: "Unable to parse structured review. Manual evaluation required.",
        strengths: ["Response generated"],
        concerns: ["Review parsing failed"],
        missingSections: ["Structured evaluation"],
        clinicalAccuracy: "Unknown",
        nhsCompliance: "Unknown",
        safetyRating: "Moderate Risk"
      };
    }

    // Validate and sanitize the review result
    reviewResult.confidenceScore = Math.max(0, Math.min(99, reviewResult.confidenceScore || 0));
    reviewResult.riskLevel = ['GREEN', 'ORANGE', 'RED'].includes(reviewResult.riskLevel) 
      ? reviewResult.riskLevel 
      : 'ORANGE';

    console.log(`✅ Review Complete - Score: ${reviewResult.confidenceScore}, Risk: ${reviewResult.riskLevel}`);

    return new Response(JSON.stringify({
      success: true,
      review: reviewResult,
      rawReview: reviewContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in GPT-5 clinical reviewer:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      review: {
        confidenceScore: 0,
        riskLevel: "RED",
        overallAssessment: `Review failed: ${error.message}`,
        strengths: [],
        concerns: ["Review system error"],
        missingSections: ["Complete evaluation"],
        clinicalAccuracy: "Unknown",
        nhsCompliance: "Unknown",
        safetyRating: "High Risk"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});