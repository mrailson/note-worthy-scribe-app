import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  originalPrompt: string;
  aiResponse: string;
  messageId: string;
}

interface VerificationSource {
  name: string;
  url: string;
  lastUpdated?: string;
  relevantContent: string;
  trustLevel: 'high' | 'medium' | 'low';
}

interface LLMConsensusData {
  model: string;
  assessment: string;
  agreementLevel: number;
  concerns?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalPrompt, aiResponse, messageId }: VerificationRequest = await req.json();

    console.log(`Clinical verification for message: ${messageId}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Define authoritative sources to check
    const sources = [
      'https://www.england.nhs.uk/long-read/flu-and-covid-19-seasonal-vaccination-programme-autumn-winter-2025-26/',
      'https://www.nice.org.uk/guidance',
      'https://bnf.nice.org.uk/',
      'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency'
    ];

    const verificationSources: VerificationSource[] = [];
    
    // Fetch content from key sources
    for (const sourceUrl of sources) {
      try {
        const response = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'NHS-AI-Verification-Service/1.0'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          // Extract relevant content (simplified)
          const relevantContent = html.substring(0, 5000);
          
          verificationSources.push({
            name: new URL(sourceUrl).hostname,
            url: sourceUrl,
            relevantContent,
            trustLevel: 'high'
          });
        }
      } catch (error) {
        console.error(`Failed to fetch ${sourceUrl}:`, error);
      }
    }

    // Use multiple LLMs for consensus
    const llmModels = ['gpt-5-2025-08-07', 'gpt-4.1-2025-04-14'];
    const llmConsensus: LLMConsensusData[] = [];

    for (const model of llmModels) {
      try {
        const verificationPrompt = `You are a clinical verification expert for NHS primary care. 

TASK: Verify the accuracy of an AI response against authoritative UK medical sources.

Original Query: "${originalPrompt}"

AI Response to Verify: "${aiResponse}"

Available Source Content: ${verificationSources.map(s => `${s.name}: ${s.relevantContent.substring(0, 1000)}`).join('\n\n')}

Provide a clinical assessment with:
1. Agreement level (0-100%) with the AI response
2. Any clinical concerns or inaccuracies found
3. Risk level assessment (low/medium/high)
4. Brief justification

Format as JSON: {
  "agreementLevel": number,
  "assessment": "brief assessment",
  "concerns": ["concern1", "concern2"],
  "riskLevel": "low|medium|high"
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'You are a clinical verification assistant for NHS primary care.' },
              { role: 'user', content: verificationPrompt }
            ],
            max_completion_tokens: 500,
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const result = JSON.parse(data.choices[0].message.content);
          
          llmConsensus.push({
            model: model,
            assessment: result.assessment,
            agreementLevel: result.agreementLevel,
            concerns: result.concerns || []
          });
        }
      } catch (error) {
        console.error(`LLM verification failed for ${model}:`, error);
      }
    }

    // Calculate overall confidence score
    const avgAgreement = llmConsensus.length > 0 
      ? llmConsensus.reduce((sum, llm) => sum + llm.agreementLevel, 0) / llmConsensus.length
      : 50;

    const sourceQuality = verificationSources.length >= 2 ? 20 : 10;
    const confidenceScore = Math.min(100, Math.max(0, avgAgreement + sourceQuality));

    // Determine risk level
    const highRiskConcerns = llmConsensus.some(llm => 
      llm.concerns?.some(concern => 
        concern.toLowerCase().includes('dosage') || 
        concern.toLowerCase().includes('contraindication') ||
        concern.toLowerCase().includes('urgent')
      )
    );

    const riskLevel = highRiskConcerns ? 'high' : confidenceScore < 60 ? 'medium' : 'low';
    const verificationStatus = confidenceScore >= 85 ? 'verified' : confidenceScore < 60 ? 'flagged' : 'verified';

    const verificationResult = {
      confidenceScore,
      verificationSources,
      llmConsensus,
      verificationTimestamp: new Date(),
      verificationStatus,
      riskLevel,
      evidenceSummary: `Verified against ${verificationSources.length} sources with ${llmConsensus.length} LLM assessments. Average agreement: ${avgAgreement.toFixed(1)}%`
    };

    console.log(`Clinical verification completed: ${confidenceScore}% confidence, ${riskLevel} risk`);

    return new Response(JSON.stringify(verificationResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clinical verification:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Clinical verification failed',
      confidenceScore: 0,
      verificationStatus: 'pending',
      riskLevel: 'medium'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});