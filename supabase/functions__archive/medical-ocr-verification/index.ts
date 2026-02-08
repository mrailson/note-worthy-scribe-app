import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRResult {
  service: string;
  text: string;
  confidence: number;
  medicalTermsDetected: string[];
  warnings: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();
    
    if (!imageData) {
      throw new Error('Image data is required');
    }

    const results: OCRResult[] = [];

    // Google Cloud Vision OCR with medical-specific settings
    if (GOOGLE_CLOUD_API_KEY) {
      try {
        const googleResult = await performGoogleVisionOCR(imageData);
        results.push(googleResult);
      } catch (error) {
        console.error('Google Vision OCR failed:', error);
        results.push({
          service: 'google_vision',
          text: '',
          confidence: 0,
          medicalTermsDetected: [],
          warnings: ['Google Vision OCR failed: ' + error.message]
        });
      }
    }

    // Analyze results for medical accuracy
    const analysis = analyzeMedicalOCRResults(results);
    
    return new Response(JSON.stringify({
      results,
      analysis,
      recommendedText: analysis.consensusText,
      confidence: analysis.overallConfidence,
      medicalWarnings: analysis.medicalWarnings
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Medical OCR verification error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      confidence: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performGoogleVisionOCR(imageData: string): Promise<OCRResult> {
  const base64Image = imageData.split(',')[1] || imageData;
  
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 10
          },
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 10
          }
        ],
        imageContext: {
          languageHints: ['ro', 'en'] // Romanian and English for medical documents
        }
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Google Vision API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.responses?.[0]?.error) {
    throw new Error(`Google Vision error: ${data.responses[0].error.message}`);
  }

  const textAnnotations = data.responses?.[0]?.textAnnotations || [];
  const fullText = textAnnotations[0]?.description || '';
  
  // Calculate confidence based on detection confidence
  const avgConfidence = textAnnotations.length > 0 
    ? textAnnotations.reduce((sum, ann) => sum + (ann.confidence || 0.8), 0) / textAnnotations.length
    : 0.5;

  const medicalTermsDetected = detectMedicalTerms(fullText);
  const warnings = validateMedicalOCR(fullText);

  return {
    service: 'google_vision',
    text: fullText,
    confidence: avgConfidence,
    medicalTermsDetected,
    warnings
  };
}

function detectMedicalTerms(text: string): string[] {
  const medicalTerms = [
    // Romanian medical terms
    'colecistitâ', 'cronică', 'litiazică', 'HTA', 'esentialâ', 'dislipidemie',
    'ecografie', 'abdominală', 'vezică', 'biliară', 'calculi', 'multipli',
    'transaminaze', 'colesterol', 'total', 'tratament', 'recomandat',
    'Atacand', 'Atorvastatină', 'No-Spa', 'dureri', 'abdominale',
    'medicul', 'familie', 'tensiunii', 'arteriale', 'chirurgie', 'generală',
    'laparoscopico', 'cholestectoromie',
    // English medical terms
    'cholecystitis', 'chronic', 'calculous', 'hypertension', 'essential',
    'dyslipidemia', 'ultrasound', 'abdominal', 'gallbladder', 'stones',
    'multiple', 'transaminases', 'cholesterol', 'treatment', 'recommended',
    'laparoscopic', 'cholecystectomy', 'blood pressure', 'surgery'
  ];

  const detected: string[] = [];
  const lowerText = text.toLowerCase();
  
  medicalTerms.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      detected.push(term);
    }
  });

  return detected;
}

function validateMedicalOCR(text: string): string[] {
  const warnings: string[] = [];
  
  // Check for common OCR errors in medical context
  if (text.includes('ngctalulu') || text.includes('ngct')) {
    warnings.push('Possible OCR error: garbled text detected that may be medical terminology');
  }
  
  // Check for suspicious numerical values
  const cholesterolMatch = text.match(/cholesterol.*?(\d+\.?\d*)\s*(mmol\/L|mg\/dL)/i);
  if (cholesterolMatch) {
    const value = parseFloat(cholesterolMatch[1]);
    if (value > 50) { // Suspiciously high cholesterol value
      warnings.push(`Suspicious cholesterol value: ${value} - please verify this is not an OCR error`);
    }
  }

  // Check for medication name inconsistencies
  if (text.includes('Atocand')) {
    warnings.push('Possible medication name error: "Atocand" should likely be "Atacand"');
  }

  // Check for duplicated phrases
  const duplicatePattern = /(.{10,})\s+\1/gi;
  if (duplicatePattern.test(text)) {
    warnings.push('Duplicated text detected - possible OCR processing error');
  }

  return warnings;
}

function analyzeMedicalOCRResults(results: OCRResult[]) {
  const validResults = results.filter(r => r.text && r.text.trim().length > 0);
  
  if (validResults.length === 0) {
    return {
      consensusText: '',
      overallConfidence: 0,
      medicalWarnings: ['No valid OCR results obtained'],
      agreement: 0
    };
  }

  // For now, use the best single result (highest confidence)
  // In a full implementation, you'd compare multiple OCR results
  const bestResult = validResults.reduce((prev, current) => 
    prev.confidence > current.confidence ? prev : current
  );

  const allWarnings = validResults.flatMap(r => r.warnings);
  const allMedicalTerms = Array.from(new Set(validResults.flatMap(r => r.medicalTermsDetected)));

  return {
    consensusText: bestResult.text,
    overallConfidence: bestResult.confidence,
    medicalWarnings: allWarnings,
    medicalTermsDetected: allMedicalTerms,
    agreement: validResults.length > 1 ? calculateTextSimilarity(validResults) : 1
  };
}

function calculateTextSimilarity(results: OCRResult[]): number {
  if (results.length < 2) return 1;
  
  // Simple similarity calculation based on length and character overlap
  const texts = results.map(r => r.text);
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const similarity = calculateStringSimilarity(texts[i], texts[j]);
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}