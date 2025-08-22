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
  service?: string;
  assessment: string;
  agreementLevel: number;
  concerns?: string[];
}

// Extract medical terms and drug names from text
function extractMedicalTerms(text: string): string[] {
  const medicalPatterns = [
    /\b[A-Z][a-z]+(?:ine|ol|ic|ide|ium|ate|ose)\b/g, // Drug suffixes
    /\b(?:mg|mcg|ml|units?)\b/gi, // Dosage units
    /\b(?:diabetes|hypertension|asthma|copd|heart|kidney|liver|cancer)\w*\b/gi, // Common conditions
    /\b[A-Z][a-z]*(?:pril|sartan|statin|blockers?)\b/gi, // Drug classes
    /\b(?:NHS|NICE|BNF|GMC|RCGP)\b/gi, // Medical authorities
  ];
  
  const terms = new Set<string>();
  medicalPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => terms.add(match.toLowerCase()));
  });
  
  // Also extract capitalized words that might be drug names
  const capitalizedWords = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  capitalizedWords.forEach(word => {
    if (word.length > 3) terms.add(word.toLowerCase());
  });
  
  return Array.from(terms);
}

// Find relevant UK medical sources based on extracted terms
function findRelevantSources(keyTerms: string[]): string[] {
  const sources = [
    'https://www.nice.org.uk/guidance',
    'https://bnf.nice.org.uk/',
    'https://www.england.nhs.uk/'
  ];
  
  // Add specific sources based on terms
  const hasCardiac = keyTerms.some(term => 
    ['heart', 'cardiac', 'hypertension', 'blood pressure', 'ace inhibitor'].includes(term)
  );
  const hasDiabetes = keyTerms.some(term => 
    ['diabetes', 'metformin', 'insulin', 'glucose'].includes(term)
  );
  const hasRespiratory = keyTerms.some(term => 
    ['asthma', 'copd', 'inhaler', 'respiratory'].includes(term)
  );
  
  if (hasCardiac) {
    sources.push('https://www.bhf.org.uk/');
  }
  if (hasDiabetes) {
    sources.push('https://www.nhs.uk/medicines/metformin/', 'https://www.diabetes.org.uk/');
  }
  if (hasRespiratory) {
    sources.push('https://www.asthma.org.uk/');
  }
  
  return sources.slice(0, 6); // Limit to 6 sources max
}

// Extract relevant content from HTML
function extractRelevantContent(html: string, keyTerms: string[]): string {
  try {
    // Remove script and style tags
    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '');
    
    // Extract text content
    const textContent = cleanHtml.replace(/<[^>]*>/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
    
    if (!textContent) return '';
    
    // Split into paragraphs
    const paragraphs = textContent.split(/\.\s+/).filter(p => p.length > 30);
    
    // Find paragraphs containing key terms
    const relevantParagraphs = paragraphs.filter(paragraph => {
      const lowerParagraph = paragraph.toLowerCase();
      return keyTerms.some(term => lowerParagraph.includes(term.toLowerCase()));
    });
    
    return relevantParagraphs.slice(0, 10).join('. ') || textContent.substring(0, 2000);
  } catch (error) {
    console.error('Error extracting content:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalPrompt, aiResponse, messageId }: VerificationRequest = await req.json();

    console.log('Clinical verification for message:', messageId);
    const startTime = Date.now();
    
    // Extract key medical terms from prompt and response
    const keyTerms = extractMedicalTerms(originalPrompt + " " + aiResponse);
    console.log('Extracted key terms:', keyTerms);

    // Find relevant authoritative sources
    const sourceUrls = findRelevantSources(keyTerms);
    console.log('Fetching sources:', sourceUrls);

    // Fetch content from sources with timeout
    const sourceStartTime = Date.now();
    const verificationSources: VerificationSource[] = [];
    
    const fetchPromises = sourceUrls.map(async (url) => {
      console.log('Fetching source:', url);
      try {
        const response = await Promise.race([
          fetch(url, {
            headers: {
              'User-Agent': 'NHS-AI-Verification-Service/1.0'
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Source timeout')), 8000))
        ]);
        
        if (response && typeof response.text === 'function') {
          const html = await response.text();
          const relevantContent = extractRelevantContent(html, keyTerms);
          return {
            name: new URL(url).hostname.replace('www.', ''),
            url,
            relevantContent,
            trustLevel: 'high' as const,
            lastUpdated: new Date().toISOString()
          };
        }
        return null;
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
        return null;
      }
    });

    // Wait for all sources with timeout
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

    const sourceEndTime = Date.now();
    console.log(`Source fetching took: ${sourceEndTime - sourceStartTime}ms, got ${verificationSources.length} sources`);

    // Use multiple AI services for comprehensive consensus
    const llmConsensus: LLMConsensusData[] = [];

    const verificationPrompt = `You are a clinical verification expert for NHS primary care. 

Please verify this AI response against authoritative UK medical sources:

ORIGINAL QUESTION: ${originalPrompt}

AI RESPONSE TO VERIFY: ${aiResponse}

AUTHORITATIVE SOURCES:
${verificationSources.map(source => `
Source: ${source.name}
URL: ${source.url}
Content: ${source.relevantContent.substring(0, 800)}...
`).join('\n')}

Please provide your assessment as a JSON response with:
{
  "assessment": "Brief clinical assessment of the AI response accuracy based on the sources",
  "agreementLevel": 85,
  "concerns": ["List any clinical concerns or inaccuracies you identify"]
}

Focus on clinical accuracy, safety, and alignment with UK primary care guidelines.`;

    // Get API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    
    console.log('Available API keys:', {
      openai: !!openaiApiKey,
      claude: !!claudeApiKey,
      google: !!googleApiKey,
      grok: !!grokApiKey
    });

    // Parallel AI service verification
    const verificationPromises: Promise<LLMConsensusData | null>[] = [];

    // OpenAI GPT verification
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
    if (claudeApiKey) {
      verificationPromises.push(
        Promise.race([
          fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': claudeApiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 400,
              messages: [{
                role: 'user',
                content: `You are a clinical verification assistant for NHS primary care.\n\n${verificationPrompt}`
              }]
            })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Claude timeout')), 15000))
        ]).then(async (response: any) => {
          if (response.ok) {
            const data = await response.json();
            const result = JSON.parse(data.content[0].text);
            
            return {
              model: 'claude-3-5-haiku',
              service: 'Anthropic',
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

    // Google Gemini verification
    if (googleApiKey) {
      verificationPromises.push(
        Promise.race([
          fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a clinical verification assistant for NHS primary care.\n\n${verificationPrompt}`
                }]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 400,
                responseMimeType: "application/json"
              }
            })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 15000))
        ]).then(async (response: any) => {
          if (response.ok) {
            const data = await response.json();
            const result = JSON.parse(data.candidates[0].content.parts[0].text);
            
            return {
              model: 'gemini-1.5-flash',
              service: 'Google',
              assessment: result.assessment,
              agreementLevel: result.agreementLevel,
              concerns: result.concerns || []
            };
          }
          return null;
        }).catch(error => {
          console.error('Gemini verification failed:', error);
          return null;
        })
      );
    }

    // Grok verification
    if (grokApiKey) {
      verificationPromises.push(
        Promise.race([
          fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${grokApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'grok-beta',
              messages: [
                { role: 'system', content: 'You are a clinical verification assistant for NHS primary care.' },
                { role: 'user', content: verificationPrompt }
              ],
              max_tokens: 400,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Grok timeout')), 15000))
        ]).then(async (response: any) => {
          if (response.ok) {
            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            
            return {
              model: 'grok-beta',
              service: 'Grok',
              assessment: result.assessment,
              agreementLevel: result.agreementLevel,
              concerns: result.concerns || []
            };
          }
          return null;
        }).catch(error => {
          console.error('Grok verification failed:', error);
          return null;
        })
      );
    }

    // Execute all verifications in parallel with overall timeout
    let aiStartTime = Date.now();
    let aiEndTime = Date.now();
    
    try {
      console.log('Running parallel AI verifications...');
      console.log(`Total verification promises created: ${verificationPromises.length}`);
      
      aiStartTime = Date.now();
      const results = await Promise.allSettled(verificationPromises);
      aiEndTime = Date.now();
      
      console.log(`AI verifications took: ${aiEndTime - aiStartTime}ms`);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          console.log(`AI verification ${index} succeeded:`, result.value.model);
          llmConsensus.push(result.value);
        } else {
          console.error(`AI verification ${index} failed:`, result.status === 'rejected' ? result.reason : 'No result');
        }
      });
      
      console.log(`Completed ${llmConsensus.length} AI verifications`);
      console.log('LLM models used:', llmConsensus.map(llm => llm.model));
    } catch (error) {
      console.error('Error in parallel verifications:', error);
      aiEndTime = Date.now();
    }

    // Calculate consensus
    const avgAgreement = llmConsensus.length > 0 
      ? llmConsensus.reduce((sum, llm) => sum + llm.agreementLevel, 0) / llmConsensus.length
      : 0;

    const confidenceScore = Math.min(95, avgAgreement * 0.9 + (verificationSources.length / 6) * 10);

    // Check for high-risk concerns
    const allConcerns = llmConsensus.flatMap(llm => llm.concerns || []);
    const highRiskConcerns = allConcerns.some(concern =>
      concern && (
        concern.toLowerCase().includes('dangerous') ||
        concern.toLowerCase().includes('harmful') ||
        concern.toLowerCase().includes('incorrect dosage') ||
        concern.toLowerCase().includes('contraindication') ||
        concern.toLowerCase().includes('urgent')
      )
    );

    const riskLevel = highRiskConcerns ? 'high' : confidenceScore < 60 ? 'medium' : 'low';
    const verificationStatus = confidenceScore >= 85 ? 'verified' : confidenceScore < 60 ? 'flagged' : 'verified';

    const totalTime = Date.now() - startTime;
    console.log('Clinical verification completed: ' + Math.floor(confidenceScore) + '% confidence, ' + riskLevel + ' risk');
    console.log(`Total verification time: ${totalTime}ms (Sources: ${sourceEndTime - sourceStartTime}ms, AI: ${aiEndTime - aiStartTime}ms)`);

    return new Response(JSON.stringify({
      confidenceScore,
      verificationSources,
      llmConsensus,
      verificationTimestamp: new Date(),
      verificationStatus,
      riskLevel,
      evidenceSummary: verificationSources.length > 0 
        ? `Verified against ${verificationSources.length} authoritative UK medical sources with ${llmConsensus.length} AI assessments`
        : 'Limited source verification available',
      timingBreakdown: {
        totalTime: totalTime,
        sourceTime: sourceEndTime - sourceStartTime,
        aiTime: aiEndTime - aiStartTime,
        sourcesFound: verificationSources.length,
        aiServicesUsed: llmConsensus.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clinical verification:', error);
    return new Response(JSON.stringify({ 
      error: 'Clinical verification failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});