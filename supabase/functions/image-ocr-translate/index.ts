import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicalValue {
  value: number;
  unit: string;
  type: string;
  position: { start: number; end: number };
  raw: string;
}

interface ValidationIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  originalValue: string;
  suggestedCorrection?: string;
  normalRange?: string;
  position?: { start: number; end: number };
}

interface ClinicalVerificationResult {
  hasIssues: boolean;
  issues: ValidationIssue[];
  detectedValues: MedicalValue[];
  overallSafety: 'safe' | 'warning' | 'unsafe';
  confidence: number;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
  clinicalVerification?: ClinicalVerificationResult;
}

// Medical value patterns with improved decimal detection - FIXED patterns
const MEDICAL_PATTERNS = [
  {
    pattern: /(?:cholesterol|colesterolutotal|total\s+cholesterol)[:\s=]+(\d+\.?\d*)\s*mmol\/L/gi,
    type: 'cholesterol',
    unit: 'mmol/L',
    normalRange: '3.0-7.0',
    normalMin: 3.0,
    normalMax: 7.0,
    criticalMax: 15.0
  },
  {
    pattern: /(\d+)\/(\d+)\s*mmHg/gi,
    type: 'blood_pressure',
    unit: 'mmHg',
    normalRange: '90-140/60-90',
    systolicMax: 180,
    diastolicMax: 110
  },
  {
    pattern: /(?:glucose|sugar)[:\s]*(\d+\.?\d*)\s*mmol\/L/gi,
    type: 'glucose',
    unit: 'mmol/L',
    normalRange: '4.0-7.0',
    normalMin: 4.0,
    normalMax: 7.0,
    criticalMax: 20.0
  },
  {
    pattern: /(\d+\.?\d*)\s*mg(?:\/day|\/zi|\/24h|(?:\s|$))/gi,
    type: 'medication_dosage',
    unit: 'mg',
    normalRange: 'varies',
    criticalMax: 2000
  }
];

function extractMedicalValues(text: string): MedicalValue[] {
  console.log('=== EXTRACTING MEDICAL VALUES ===');
  console.log('Text to analyze:', text?.substring(0, 200) + '...');
  const values: MedicalValue[] = [];
  
  for (const pattern of MEDICAL_PATTERNS) {
    console.log(`Testing pattern: ${pattern.pattern} for type: ${pattern.type}`);
    const matches = [...text.matchAll(pattern.pattern)];
    console.log(`Found ${matches.length} matches for ${pattern.type}:`, matches.map(m => m[0]));
    
    for (const match of matches) {
      console.log(`Processing match: "${match[0]}" at position ${match.index}`);
      
      if (pattern.type === 'blood_pressure') {
        const systolic = parseInt(match[1]);
        const diastolic = parseInt(match[2]);
        
        values.push({
          value: systolic,
          unit: pattern.unit,
          type: 'blood_pressure_systolic',
          position: { start: match.index!, end: match.index! + match[0].length },
          raw: match[0]
        });
        
        values.push({
          value: diastolic,
          unit: pattern.unit,
          type: 'blood_pressure_diastolic', 
          position: { start: match.index!, end: match.index! + match[0].length },
          raw: match[0]
        });
      } else {
        const value = parseFloat(match[1]);
        console.log(`Extracted ${pattern.type} value: ${value} ${pattern.unit}`);
        values.push({
          value,
          unit: pattern.unit,
          type: pattern.type,
          position: { start: match.index!, end: match.index! + match[0].length },
          raw: match[0]
        });
      }
    }
  }
  
  console.log('=== TOTAL MEDICAL VALUES EXTRACTED ===', values);
  return values;
}

function validateMedicalValues(values: MedicalValue[]): ValidationIssue[] {
  console.log('=== VALIDATING MEDICAL VALUES ===');
  const issues: ValidationIssue[] = [];
  
  for (const medValue of values) {
    console.log(`Validating: ${medValue.type} = ${medValue.value} ${medValue.unit}`);
    const pattern = MEDICAL_PATTERNS.find(p => p.type === medValue.type || 
      (medValue.type.startsWith('blood_pressure') && p.type === 'blood_pressure'));
    
    if (!pattern) continue;
    
    // Check for decimal point errors (common OCR issue)
    if (medValue.type === 'cholesterol' && medValue.value > 15) {
      const suggestedValue = medValue.value / 10;
      if (suggestedValue >= 3 && suggestedValue <= 12) {
        console.log(`🚨 CRITICAL: Cholesterol ${medValue.value} flagged as decimal error!`);
        issues.push({
          severity: 'critical',
          type: 'decimal_point_error',
          message: `Cholesterol value ${medValue.value} ${medValue.unit} is extremely high. This may be a decimal point error.`,
          originalValue: medValue.raw,
          suggestedCorrection: `${suggestedValue} ${medValue.unit}`,
          normalRange: pattern.normalRange,
          position: medValue.position
        });
        continue;
      }
    }
    
    // Check for out-of-range values
    if (pattern.normalMin && medValue.value < pattern.normalMin) {
      issues.push({
        severity: 'medium',
        type: 'below_normal_range',
        message: `${medValue.type.replace('_', ' ')} value ${medValue.value} ${medValue.unit} is below normal range.`,
        originalValue: medValue.raw,
        normalRange: pattern.normalRange,
        position: medValue.position
      });
    }
    
    if (pattern.normalMax && medValue.value > pattern.normalMax) {
      const severity = pattern.criticalMax && medValue.value > pattern.criticalMax ? 'critical' : 'high';
      console.log(`🚨 ${severity.toUpperCase()}: ${medValue.type} ${medValue.value} is above normal range!`);
      issues.push({
        severity,
        type: 'above_normal_range',
        message: `${medValue.type.replace('_', ' ')} value ${medValue.value} ${medValue.unit} is ${severity === 'critical' ? 'extremely' : ''} above normal range.`,
        originalValue: medValue.raw,
        normalRange: pattern.normalRange,
        position: medValue.position
      });
    }
  }
  
  console.log(`=== VALIDATION COMPLETE: ${issues.length} issues found ===`);
  return issues;
}

function checkForCommonOCRErrors(text: string): ValidationIssue[] {
  console.log('=== CHECKING FOR OCR ERRORS ===');
  const issues: ValidationIssue[] = [];
  
  // Check for missing decimal points in cholesterol values - FIXED pattern
  const cholesterolMatches = [...text.matchAll(/(?:cholesterol|colesterolutotal|total\s+cholesterol)[:\s=]+(\d{2,3})\s*mmol\/L/gi)];
  console.log(`Found ${cholesterolMatches.length} cholesterol matches for OCR error check:`, cholesterolMatches.map(m => m[0]));
  
  for (const match of cholesterolMatches) {
    const value = parseInt(match[1]);
    console.log(`Checking cholesterol OCR error for value: ${value} from text: "${match[0]}"`);
    
    if (value > 15) {
      const decimal1 = value / 10;
      
      if (decimal1 >= 3 && decimal1 <= 12) {
        console.log(`🚨 CRITICAL OCR ERROR: Cholesterol ${value} flagged as decimal error, suggesting ${decimal1}!`);
        issues.push({
          severity: 'critical',
          type: 'ocr_decimal_error',
          message: `Cholesterol value ${value} mmol/L appears to be missing a decimal point.`,
          originalValue: match[0],
          suggestedCorrection: `${decimal1} mmol/L`,
          normalRange: '3.0-7.0 mmol/L',
          position: { start: match.index!, end: match.index! + match[0].length }
        });
      }
    }
  }
  
  console.log(`=== OCR ERROR CHECK COMPLETE: ${issues.length} issues found ===`);
  return issues;
}

function performClinicalVerification(originalText: string, translatedText: string): ClinicalVerificationResult {
  console.log('=== CLINICAL VERIFICATION DEBUG START ===');
  console.log('Original text length:', originalText?.length || 0);
  console.log('Translated text length:', translatedText?.length || 0);
  console.log('Original text sample:', originalText?.substring(0, 300));
  console.log('Translated text sample:', translatedText?.substring(0, 300));
  
  // Extract medical values from both texts
  console.log('--- EXTRACTING FROM ORIGINAL TEXT ---');
  const originalValues = extractMedicalValues(originalText);
  console.log('--- EXTRACTING FROM TRANSLATED TEXT ---');
  const translatedValues = extractMedicalValues(translatedText);
  
  console.log('Medical values summary:', { 
    original: originalValues.length, 
    translated: translatedValues.length,
    originalValues: originalValues,
    translatedValues: translatedValues
  });
  
  // Validate medical values
  console.log('--- VALIDATING ORIGINAL VALUES ---');
  const originalIssues = validateMedicalValues(originalValues);
  console.log('--- VALIDATING TRANSLATED VALUES ---');
  const translatedIssues = validateMedicalValues(translatedValues);
  
  console.log('Validation issues:', {
    originalIssues: originalIssues.length,
    translatedIssues: translatedIssues.length
  });
  
  // Check for OCR errors
  console.log('--- CHECKING OCR ERRORS IN ORIGINAL ---');
  const ocrIssues = checkForCommonOCRErrors(originalText);
  console.log('--- CHECKING OCR ERRORS IN TRANSLATED ---');
  const translationOcrIssues = checkForCommonOCRErrors(translatedText);
  
  console.log('OCR error issues:', {
    original: ocrIssues.length,
    translated: translationOcrIssues.length,
    ocrIssues: ocrIssues,
    translationOcrIssues: translationOcrIssues
  });
  
  // Combine all issues
  const allIssues = [
    ...originalIssues.map(issue => ({ ...issue, source: 'original' })),
    ...translatedIssues.map(issue => ({ ...issue, source: 'translated' })),
    ...ocrIssues.map(issue => ({ ...issue, source: 'original_ocr' })),
    ...translationOcrIssues.map(issue => ({ ...issue, source: 'translated_ocr' }))
  ];
  
  console.log('=== FINAL CLINICAL VERIFICATION RESULT ===');
  console.log(`Total issues found: ${allIssues.length}`);
  console.log('All issues:', allIssues);
  
  // Determine overall safety
  let overallSafety: 'safe' | 'warning' | 'unsafe' = 'safe';
  if (allIssues.some(issue => issue.severity === 'critical')) {
    overallSafety = 'unsafe';
  } else if (allIssues.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
    overallSafety = 'warning';
  }
  
  console.log('Overall safety determination:', overallSafety);
  
  // Calculate confidence
  const criticalIssues = allIssues.filter(issue => issue.severity === 'critical').length;
  const highIssues = allIssues.filter(issue => issue.severity === 'high').length;
  const mediumIssues = allIssues.filter(issue => issue.severity === 'medium').length;
  
  let confidence = 0.95;
  confidence -= criticalIssues * 0.3;
  confidence -= highIssues * 0.15;
  confidence -= mediumIssues * 0.05;
  confidence = Math.max(0.1, Math.min(1.0, confidence));
  
  const result = {
    hasIssues: allIssues.length > 0,
    issues: allIssues,
    detectedValues: [...originalValues, ...translatedValues],
    overallSafety,
    confidence
  };
  
  console.log('=== CLINICAL VERIFICATION DEBUG END ===');
  console.log('Final result:', result);
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    const googleTranslateApiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');

    if (!googleVisionApiKey) {
      console.error('Missing Google Vision API key');
      return new Response(
        JSON.stringify({ error: 'Google Vision API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!googleTranslateApiKey) {
      console.error('Missing Google Translate API key');
      return new Response(
        JSON.stringify({ error: 'Google Translate API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { imageData, sourceLanguage = null, targetLanguage = 'en' } = await req.json();

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Starting OCR processing...');

    // Step 1: Extract text using Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageData.replace(/^data:image\/[a-z]+;base64,/, ''),
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'OCR processing failed', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const visionResult = await visionResponse.json();
    console.log('Vision API response received');

    if (!visionResult.responses || !visionResult.responses[0]) {
      return new Response(
        JSON.stringify({ error: 'No OCR response received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const textAnnotations = visionResult.responses[0].textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No text found in image',
          originalText: '',
          translatedText: '',
          detectedLanguage: 'unknown',
          confidence: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const extractedText = textAnnotations[0].description;
    console.log('Extracted text:', extractedText.substring(0, 200) + '...');

    // Step 2: Detect language and translate using Google Translate API
    const translateBody = {
      q: extractedText,
      target: targetLanguage,
      format: 'text',
    };
    
    // Add source language if specified (not auto-detect)
    if (sourceLanguage) {
      translateBody.source = sourceLanguage;
    }
    
    const translateResponse = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleTranslateApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(translateBody),
      }
    );

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error('Translate API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Translation failed', 
          details: errorText,
          originalText: extractedText,
          translatedText: extractedText,
          detectedLanguage: 'unknown',
          confidence: 0.7
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const translateResult = await translateResponse.json();
    console.log('Translation completed');

    if (!translateResult.data || !translateResult.data.translations || translateResult.data.translations.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No translation received',
          originalText: extractedText,
          translatedText: extractedText,
          detectedLanguage: 'unknown',
          confidence: 0.7
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const translation = translateResult.data.translations[0];
    const result: TranslationResult = {
      originalText: extractedText,
      translatedText: translation.translatedText,
      detectedLanguage: translation.detectedSourceLanguage || 'unknown',
      confidence: 0.85 // Default confidence score
    };

    console.log('OCR and translation completed successfully');
    
    // Perform clinical verification
    const clinicalVerification = performClinicalVerification(extractedText, translation.translatedText);
    
    const finalResult = {
      ...result,
      clinicalVerification
    };
    
    console.log('Final result with clinical verification:', {
      hasIssues: clinicalVerification.hasIssues,
      issuesCount: clinicalVerification.issues.length,
      overallSafety: clinicalVerification.overallSafety
    });
    
    return new Response(
      JSON.stringify(finalResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in image-ocr-translate function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        originalText: '',
        translatedText: '',
        detectedLanguage: 'unknown',
        confidence: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});