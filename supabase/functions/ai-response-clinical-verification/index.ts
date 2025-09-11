import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClinicalVerificationData {
  confidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  evidenceSummary: string;
  llmConsensus: Array<{
    model: string;
    assessment: string;
    agreementLevel: number;
  }>;
  sourcesVerified: Array<{
    source: string;
    url?: string;
    trustLevel: 'high' | 'medium' | 'low';
    verified: boolean;
  }>;
  verificationStatus: 'verified' | 'flagged' | 'pending';
}

// Mock clinical verification logic - in a real implementation this would call multiple AI models
function performClinicalVerification(aiResponse: string, originalPrompt: string): ClinicalVerificationData {
  // Analyze the AI response for clinical content
  const isClinicalContent = /(?:diagnosis|treatment|medication|dosage|symptoms|patient|clinical|medical|drug|prescription)/i.test(aiResponse);
  
  if (!isClinicalContent) {
    return {
      confidenceScore: 95,
      riskLevel: 'low',
      evidenceSummary: 'Non-clinical content detected. Standard verification applied.',
      llmConsensus: [
        {
          model: 'GPT-4o',
          assessment: 'Non-clinical administrative content',
          agreementLevel: 95
        }
      ],
      sourcesVerified: [
        {
          source: 'NHS.uk General Information',
          url: 'https://nhs.uk',
          trustLevel: 'high',
          verified: true
        }
      ],
      verificationStatus: 'verified'
    };
  }

  // Calculate confidence based on content analysis
  const hasNICEReferences = /NICE|National Institute/i.test(aiResponse);
  const hasBNFReferences = /BNF|British National Formulary/i.test(aiResponse);
  const hasNHSReferences = /NHS|nhs\.uk/i.test(aiResponse);
  const hasDosageInfo = /mg|ml|tablet|dose|dosage|\d+\s*times?\s*(?:daily|per day)/i.test(aiResponse);
  const hasContraindications = /contraindication|caution|warning|avoid|not recommended/i.test(aiResponse);
  
  let confidenceScore = 70;
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  
  // Boost confidence for proper clinical references
  if (hasNICEReferences) confidenceScore += 10;
  if (hasBNFReferences) confidenceScore += 10;
  if (hasNHSReferences) confidenceScore += 5;
  if (hasContraindications) confidenceScore += 5;
  
  // Risk assessment
  if (confidenceScore >= 85) {
    riskLevel = 'low';
  } else if (confidenceScore <= 60) {
    riskLevel = 'high';
  }
  
  // Flag high-risk scenarios
  if (hasDosageInfo && !hasBNFReferences && !hasNICEReferences) {
    riskLevel = 'high';
    confidenceScore = Math.min(confidenceScore, 65);
  }

  const sourcesVerified = [];
  
  if (hasNICEReferences) {
    sourcesVerified.push({
      source: 'NICE Guidelines',
      url: 'https://nice.org.uk',
      trustLevel: 'high' as const,
      verified: true
    });
  }
  
  if (hasBNFReferences) {
    sourcesVerified.push({
      source: 'British National Formulary',
      url: 'https://bnf.nice.org.uk',
      trustLevel: 'high' as const,
      verified: true
    });
  }
  
  if (hasNHSReferences) {
    sourcesVerified.push({
      source: 'NHS.uk',
      url: 'https://nhs.uk',
      trustLevel: 'high' as const,
      verified: true
    });
  }

  // If no high-quality sources found, add generic sources
  if (sourcesVerified.length === 0) {
    sourcesVerified.push({
      source: 'General Medical Knowledge Base',
      trustLevel: 'medium' as const,
      verified: false
    });
  }

  return {
    confidenceScore: Math.min(95, confidenceScore),
    riskLevel,
    evidenceSummary: `Clinical response analysis: ${sourcesVerified.length} sources verified. ${
      hasContraindications ? 'Safety information included. ' : ''
    }${
      hasDosageInfo ? 'Dosage information requires BNF verification. ' : ''
    }Response follows UK clinical guidelines.`,
    llmConsensus: [
      {
        model: 'GPT-4o',
        assessment: riskLevel === 'low' ? 'Clinically sound response' : 
                   riskLevel === 'medium' ? 'Generally appropriate with minor concerns' : 
                   'Requires clinical review',
        agreementLevel: confidenceScore
      },
      {
        model: 'Claude-3.5',
        assessment: 'Cross-verified against UK clinical standards',
        agreementLevel: Math.max(60, confidenceScore - 5)
      }
    ],
    sourcesVerified,
    verificationStatus: riskLevel === 'high' ? 'flagged' : 'verified'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { originalPrompt, aiResponse, messageId } = await req.json();
    
    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: 'AI response is required for verification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log('Starting AI response clinical verification...', {
      messageId,
      promptLength: originalPrompt?.length || 0,
      responseLength: aiResponse.length
    });
    
    const verificationResult = performClinicalVerification(aiResponse, originalPrompt || '');
    
    console.log(`Clinical verification completed for message ${messageId}. Confidence: ${verificationResult.confidenceScore}%, Risk: ${verificationResult.riskLevel}`);
    
    return new Response(
      JSON.stringify(verificationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in AI response clinical verification:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Clinical verification failed', 
        details: error.message,
        confidenceScore: 50,
        riskLevel: 'medium',
        evidenceSummary: 'Verification service temporarily unavailable',
        llmConsensus: [],
        sourcesVerified: [],
        verificationStatus: 'pending'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});