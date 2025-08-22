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
  service: string;
  assessment: string;
  agreementLevel: number;
  concerns?: string[];
}

// Helper function to extract medical terms from text
function extractMedicalTerms(text: string): string[] {
  const commonMedicalTerms = [
    'metformin', 'insulin', 'statins', 'aspirin', 'paracetamol', 'ibuprofen', 
    'antibiotics', 'blood pressure', 'diabetes', 'asthma', 'copd', 'heart disease',
    'vaccination', 'covid', 'flu', 'pneumonia', 'hypertension', 'cholesterol',
    'contraception', 'pregnancy', 'mental health', 'depression', 'anxiety'
  ];
  
  const words = text.toLowerCase().split(/\s+/);
  const foundTerms = words.filter(word => 
    commonMedicalTerms.some(term => word.includes(term) || term.includes(word))
  );
  
  // Also extract potential drug names (words ending in common drug suffixes)
  const drugSuffixes = ['pril', 'olol', 'ine', 'ide', 'cin', 'max', 'tol'];
  const potentialDrugs = words.filter(word => 
    drugSuffixes.some(suffix => word.endsWith(suffix)) && word.length > 4
  );
  
  return [...new Set([...foundTerms, ...potentialDrugs])];
}

// Helper function to find relevant sources based on key terms
async function findRelevantSources(keyTerms: string[]): Promise<string[]> {
  const sources: string[] = [];
  
  // Base authoritative sources
  sources.push(
    'https://www.nice.org.uk/guidance',
    'https://bnf.nice.org.uk/',
    'https://www.england.nhs.uk/'
  );
  
  // Add specific sources based on key terms
  for (const term of keyTerms) {
    if (term.includes('metformin') || term.includes('diabetes')) {
      sources.push(
        'https://www.nhs.uk/medicines/metformin/',
        'https://www.diabetes.org.uk/',
        'https://www.nice.org.uk/guidance/ng28'
      );
    }
    if (term.includes('statin') || term.includes('cholesterol')) {
      sources.push(
        'https://www.nhs.uk/conditions/high-cholesterol/',
        'https://www.nice.org.uk/guidance/cg181'
      );
    }
    if (term.includes('blood pressure') || term.includes('hypertension')) {
      sources.push(
        'https://www.nhs.uk/conditions/high-blood-pressure-hypertension/',
        'https://www.nice.org.uk/guidance/ng136'
      );
    }
    if (term.includes('vaccination') || term.includes('vaccine')) {
      sources.push(
        'https://www.nhs.uk/vaccinations/',
        'https://www.gov.uk/government/collections/immunisation-against-infectious-disease-the-green-book'
      );
    }
  }
  
  return [...new Set(sources)];
}

// Helper function to extract relevant content from HTML
function extractRelevantContent(html: string, keyTerms: string[]): string {
  // Simple content extraction - in a real implementation, you'd use a proper HTML parser
  const textContent = html.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Find paragraphs containing key terms
  const paragraphs = textContent.split(/\.\s+/);
  const relevantParagraphs = paragraphs.filter(paragraph => 
    keyTerms.some(term => paragraph.toLowerCase().includes(term.toLowerCase()))
  );
  
  return relevantParagraphs.slice(0, 10).join('. ') || textContent.substring(0, 2000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalPrompt, aiResponse, messageId }: VerificationRequest = await req.json();

    console.log(`Clinical verification for message: ${messageId}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const grokApiKey = Deno.env.get('GROK_API_KEY');

    // Smart source finding - extract key terms to find more relevant pages
    const keyTerms = extractMedicalTerms(originalPrompt + ' ' + aiResponse);
    console.log('Extracted key terms:', keyTerms);

    const verificationSources: VerificationSource[] = [];
    
    // Search for specific sources based on extracted terms
    const specificSources = await findRelevantSources(keyTerms);
    
    // Fetch content from specific sources with timeout
    const fetchPromises = specificSources.slice(0, 5).map(async (sourceUrl) => {
      try {
        console.log(`Fetching source: ${sourceUrl}`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 8000)
        );
        
        // Race the fetch against the timeout
        const response = await Promise.race([
          fetch(sourceUrl, {
            headers: {
              'User-Agent': 'NHS-AI-Verification-Service/1.0'
            }
          }),
          timeoutPromise
        ]) as Response;
        
        if (response.ok) {
          const html = await response.text();
          // Extract more relevant content by looking for key terms
          const relevantContent = extractRelevantContent(html, keyTerms);
          
          return {
            name: new URL(sourceUrl).hostname,
            url: sourceUrl,
            relevantContent: relevantContent.substring(0, 2000), // Reduced size
            trustLevel: 'high' as const
          };
        }
      } catch (error) {
        console.error(`Failed to fetch ${sourceUrl}:`, error);
        return null;
      }
    });

    // Wait for all sources with overall timeout
    try {
      const results = await Promise.allSettled(fetchPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          verificationSources.push(result.value);
        }
      });
    } catch (error) {
      console.error('Error fetching sources:', error);
    }

    // Use multiple AI services for comprehensive consensus
    const llmConsensus: LLMConsensusData[] = [];

    const verificationPrompt = `You are a clinical verification expert for NHS primary care. 

TASK: Verify the accuracy of an AI response against authoritative UK medical sources.

Original Query: "${originalPrompt.substring(0, 500)}..."

AI Response to Verify: "${aiResponse.substring(0, 1000)}..."

Available Source Content: ${verificationSources.map(s => `${s.name}: ${s.relevantContent.substring(0, 800)}`).join('\n\n')}

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

    // Run AI verifications in parallel with shorter timeouts
    const verificationPromises = [];

    // OpenAI verification
    if (openaiApiKey) {
      verificationPromises.push(
        Promise.race([
          fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a clinical verification assistant for NHS primary care.' },
                { role: 'user', content: verificationPrompt }
              ],
              max_tokens: 400,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 15000))
        ]).then(async (response: any) => {
          if (response.ok) {
            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            
            return {
              model: 'gpt-4o-mini',
              service: 'OpenAI',
              assessment: result.assessment,
              agreementLevel: result.agreementLevel,
              concerns: result.concerns || []
            };
          }
          return null;
        }).catch(error => {
          console.error('OpenAI verification failed:', error);
          return null;
        })
      );
    }

    // Claude verification  
    if (anthropicApiKey) {
      verificationPromises.push(
        Promise.race([
          fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anthropicApiKey}`,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 400,
              messages: [
                { role: 'user', content: `You are a clinical verification assistant for NHS primary care.\n\n${verificationPrompt}` }
              ]
            })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Claude timeout')), 15000))
        ]).then(async (response: any) => {
          if (response.ok) {
            const data = await response.json();
            const result = JSON.parse(data.content[0].text);
            
            return {
              model: 'claude-3-5-haiku-20241022',
              service: 'Claude',
              assessment: result.assessment,
              agreementLevel: result.agreementLevel,
              concerns: result.concerns || []
            };
          }
          return null;
        }).catch(error => {
          console.error('Claude verification failed:', error);
          return null;
        })
      );
    }

    // Execute all verifications in parallel with overall timeout
    try {
      console.log('Running parallel AI verifications...');
      const results = await Promise.allSettled(verificationPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          llmConsensus.push(result.value);
        }
      });
      
      console.log(`Completed ${llmConsensus.length} AI verifications`);
    } catch (error) {
      console.error('Error in parallel verifications:', error);
    }

    // Calculate overall confidence score
    const avgAgreement = llmConsensus.length > 0 
      ? llmConsensus.reduce((sum, llm) => sum + llm.agreementLevel, 0) / llmConsensus.length
      : 50;

    const sourceQuality = verificationSources.length >= 2 ? 20 : 10;
    const confidenceScore = Math.min(95, Math.max(0, avgAgreement + sourceQuality));

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