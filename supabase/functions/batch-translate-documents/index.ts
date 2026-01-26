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

// Medical value patterns for clinical verification
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
  const values: MedicalValue[] = [];
  
  for (const pattern of MEDICAL_PATTERNS) {
    const matches = [...text.matchAll(pattern.pattern)];
    
    for (const match of matches) {
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
  
  return values;
}

function validateMedicalValues(values: MedicalValue[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  for (const medValue of values) {
    const pattern = MEDICAL_PATTERNS.find(p => p.type === medValue.type || 
      (medValue.type.startsWith('blood_pressure') && p.type === 'blood_pressure'));
    
    if (!pattern) continue;
    
    // Check for decimal point errors (common OCR issue)
    if (medValue.type === 'cholesterol' && medValue.value > 15) {
      const suggestedValue = medValue.value / 10;
      if (suggestedValue >= 3 && suggestedValue <= 12) {
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
  
  return issues;
}

function performClinicalVerification(originalText: string, translatedText: string): ClinicalVerificationResult {
  // Extract medical values from both texts
  const originalValues = extractMedicalValues(originalText);
  const translatedValues = extractMedicalValues(translatedText);
  
  // Validate medical values
  const originalIssues = validateMedicalValues(originalValues);
  const translatedIssues = validateMedicalValues(translatedValues);
  
  // Combine all issues
  const allIssues = [
    ...originalIssues.map(issue => ({ ...issue, source: 'original' })),
    ...translatedIssues.map(issue => ({ ...issue, source: 'translated' }))
  ];
  
  // Determine overall safety
  let overallSafety: 'safe' | 'warning' | 'unsafe' = 'safe';
  if (allIssues.some(issue => issue.severity === 'critical')) {
    overallSafety = 'unsafe';
  } else if (allIssues.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
    overallSafety = 'warning';
  }
  
  // Calculate confidence
  const criticalIssues = allIssues.filter(issue => issue.severity === 'critical').length;
  const highIssues = allIssues.filter(issue => issue.severity === 'high').length;
  const mediumIssues = allIssues.filter(issue => issue.severity === 'medium').length;
  
  let confidence = 0.95;
  confidence -= criticalIssues * 0.3;
  confidence -= highIssues * 0.15;
  confidence -= mediumIssues * 0.05;
  confidence = Math.max(0.1, Math.min(1.0, confidence));
  
  return {
    hasIssues: allIssues.length > 0,
    issues: allIssues,
    detectedValues: [...originalValues, ...translatedValues],
    overallSafety,
    confidence
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleTranslateApiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');

    if (!googleTranslateApiKey) {
      console.error('Missing Google Translate API key');
      return new Response(
        JSON.stringify({ error: 'Google Translate API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { text, sourceLanguage = 'auto', targetLanguage = 'en', sessionId } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided for translation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Translating document: ${text.length} characters, source: ${sourceLanguage}, target: ${targetLanguage}`);

    // Translate using Google Translate API
    const translateBody: Record<string, string> = {
      q: text,
      target: targetLanguage,
      format: 'text',
    };
    
    // Add source language if specified (not auto-detect)
    if (sourceLanguage && sourceLanguage !== 'auto') {
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
          originalText: text,
          translatedText: text,
          detectedLanguage: sourceLanguage,
          confidence: 0.5
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
          originalText: text,
          translatedText: text,
          detectedLanguage: sourceLanguage,
          confidence: 0.5
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const translation = translateResult.data.translations[0];
    
    // Perform clinical verification on translated text
    const clinicalVerification = performClinicalVerification(text, translation.translatedText);
    
    const result = {
      originalText: text,
      translatedText: translation.translatedText,
      detectedLanguage: translation.detectedSourceLanguage || sourceLanguage,
      confidence: 0.85,
      clinicalVerification
    };

    console.log('Document translation completed:', {
      originalLength: text.length,
      translatedLength: translation.translatedText.length,
      detectedLanguage: result.detectedLanguage,
      hasIssues: clinicalVerification.hasIssues,
      issuesCount: clinicalVerification.issues.length
    });
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch-translate-documents function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
