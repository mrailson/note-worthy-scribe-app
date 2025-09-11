import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicalReviewResult {
  overallAccuracy: number;
  medicalSafety: 'safe' | 'warning' | 'unsafe';
  specificIssues: Array<{
    type: 'terminology' | 'dosage' | 'procedure' | 'measurement' | 'formatting';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
    location?: string;
  }>;
  recommendations: string[];
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, translatedText, sourceLanguage = 'ro', targetLanguage = 'en' } = await req.json();
    
    if (!originalText || !translatedText) {
      throw new Error('Both original and translated text are required');
    }

    console.log('Starting AI medical translation review...');

    // Perform comprehensive medical translation review using OpenAI
    const reviewResult = await performMedicalTranslationReview(
      originalText, 
      translatedText, 
      sourceLanguage, 
      targetLanguage
    );

    return new Response(JSON.stringify(reviewResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI medical translation review error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      overallAccuracy: 0,
      medicalSafety: 'unsafe',
      confidence: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performMedicalTranslationReview(
  originalText: string, 
  translatedText: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<MedicalReviewResult> {
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        {
          role: 'system',
          content: `You are an expert medical translator and clinical safety reviewer specializing in Romanian-English medical document translation. Your task is to perform a comprehensive safety and accuracy review of a medical translation.

CRITICAL EVALUATION CRITERIA:
1. **Medical Terminology Accuracy**: Verify all medical terms are correctly translated
2. **Dosage and Measurement Precision**: Ensure all numerical values, dosages, and lab results are accurate
3. **Medication Name Accuracy**: Verify pharmaceutical names are correct
4. **Procedural Terminology**: Check medical procedures are properly translated
5. **Clinical Context Preservation**: Ensure medical meaning is maintained
6. **Patient Safety Impact**: Assess if errors could impact patient care

KNOWN ISSUES TO CHECK FOR:
- "Atocand" should be "Atacand"
- "chronic lithiasis cholecystitis" should be "chronic calculous cholecystitis"
- Decimal point errors in lab values (e.g., 69 mmol/L should be 6.9 mmol/L)
- Garbled OCR terms like "ngctalulu"
- Mixed language terms
- Duplicated phrases
- Incomplete procedure names

RESPONSE FORMAT:
Return a JSON object with:
{
  "overallAccuracy": 0-100,
  "medicalSafety": "safe|warning|unsafe",
  "specificIssues": [
    {
      "type": "terminology|dosage|procedure|measurement|formatting",
      "severity": "low|medium|high|critical",
      "description": "detailed description",
      "suggestion": "specific correction",
      "location": "text excerpt where issue occurs"
    }
  ],
  "recommendations": ["list of actionable recommendations"],
  "confidence": 0-100
}

SEVERITY GUIDELINES:
- **Critical**: Could directly harm patient (wrong dosages, incorrect diagnoses)
- **High**: Significant medical inaccuracy (wrong procedure names, medication errors)
- **Medium**: Important but not dangerous (terminology issues, formatting problems)
- **Low**: Minor issues that don't affect medical meaning`
        },
        {
          role: 'user',
          content: `Please review this medical translation:

ORIGINAL (${sourceLanguage}):
${originalText}

TRANSLATION (${targetLanguage}):
${translatedText}

Perform a comprehensive medical safety and accuracy review.`
        }
      ],
      max_completion_tokens: 2000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const reviewContent = data.choices[0].message.content;

  try {
    // Try to parse the JSON response
    const reviewResult = JSON.parse(reviewContent);
    
    // Validate the response structure
    if (!reviewResult.overallAccuracy || !reviewResult.medicalSafety) {
      throw new Error('Invalid review result structure');
    }

    return reviewResult;
  } catch (parseError) {
    console.error('Failed to parse AI review result:', parseError);
    
    // Fallback: create a basic review result based on content analysis
    return createFallbackReview(originalText, translatedText, reviewContent);
  }
}

function createFallbackReview(originalText: string, translatedText: string, reviewContent: string): MedicalReviewResult {
  const issues: Array<{
    type: 'terminology' | 'dosage' | 'procedure' | 'measurement' | 'formatting';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
    location?: string;
  }> = [];

  // Basic checks for known issues
  if (translatedText.includes('Atocand')) {
    issues.push({
      type: 'terminology',
      severity: 'high',
      description: 'Incorrect medication name: "Atocand"',
      suggestion: 'Replace with "Atacand"',
      location: 'Atocand'
    });
  }

  if (translatedText.includes('chronic lithiasis cholecystitis')) {
    issues.push({
      type: 'terminology',
      severity: 'medium',
      description: 'Imprecise medical terminology',
      suggestion: 'Use "chronic calculous cholecystitis" instead',
      location: 'chronic lithiasis cholecystitis'
    });
  }

  // Check for suspicious numerical values
  const cholesterolMatch = translatedText.match(/cholesterol.*?(\d+\.?\d*)\s*mmol\/L/i);
  if (cholesterolMatch) {
    const value = parseFloat(cholesterolMatch[1]);
    if (value > 20) {
      issues.push({
        type: 'measurement',
        severity: 'critical',
        description: `Extremely high cholesterol value: ${value} mmol/L`,
        suggestion: 'Verify if decimal point is missing (e.g., should be 6.9 not 69)',
        location: cholesterolMatch[0]
      });
    }
  }

  const overallAccuracy = Math.max(0, 100 - (issues.length * 15));
  const hasCriticalIssues = issues.some(i => i.severity === 'critical');
  const hasHighIssues = issues.some(i => i.severity === 'high');

  return {
    overallAccuracy,
    medicalSafety: hasCriticalIssues ? 'unsafe' : hasHighIssues ? 'warning' : 'safe',
    specificIssues: issues,
    recommendations: [
      'Manual medical review recommended due to AI parsing issues',
      'Verify all numerical values and medication names',
      'Cross-reference with original document for accuracy'
    ],
    confidence: 60 // Lower confidence due to fallback processing
  };
}