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

// Medical value patterns with improved decimal detection
const MEDICAL_PATTERNS = [
  {
    pattern: /cholesterol[:\s]*(\d+\.?\d*)\s*mmol\/L/gi,
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
  },
  {
    pattern: /heart rate[:\s]*(\d+)\s*(?:bpm|\/min)?/gi,
    type: 'heart_rate',
    unit: 'bpm',
    normalRange: '60-100',
    normalMin: 60,
    normalMax: 100,
    criticalMax: 200
  },
  {
    pattern: /temperature[:\s]*(\d+\.?\d*)\s*°?C/gi,
    type: 'temperature',
    unit: '°C',
    normalRange: '36.0-37.5',
    normalMin: 36.0,
    normalMax: 37.5,
    criticalMax: 42.0
  }
];

function extractMedicalValues(text: string): MedicalValue[] {
  const values: MedicalValue[] = [];
  
  for (const pattern of MEDICAL_PATTERNS) {
    const matches = [...text.matchAll(pattern.pattern)];
    
    for (const match of matches) {
      if (pattern.type === 'blood_pressure') {
        // Handle blood pressure separately (systolic/diastolic)
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

function validateMedicalValues(values: MedicalValue[], originalText: string): ValidationIssue[] {
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
    
    // Special validation for blood pressure
    if (medValue.type === 'blood_pressure_systolic' && medValue.value > 180) {
      issues.push({
        severity: 'critical',
        type: 'hypertensive_crisis',
        message: `Systolic blood pressure ${medValue.value} mmHg indicates potential hypertensive crisis.`,
        originalValue: medValue.raw,
        normalRange: '90-140 mmHg',
        position: medValue.position
      });
    }
    
    if (medValue.type === 'blood_pressure_diastolic' && medValue.value > 110) {
      issues.push({
        severity: 'critical',
        type: 'hypertensive_crisis',
        message: `Diastolic blood pressure ${medValue.value} mmHg indicates potential hypertensive crisis.`,
        originalValue: medValue.raw,
        normalRange: '60-90 mmHg',
        position: medValue.position
      });
    }
  }
  
  return issues;
}

function checkForCommonOCRErrors(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check for missing decimal points in cholesterol values
  const cholesterolMatches = [...text.matchAll(/cholesterol[:\s]*(\d{2,3})\s*mmol\/L/gi)];
  for (const match of cholesterolMatches) {
    const value = parseInt(match[1]);
    if (value > 15) {
      const decimal1 = value / 10;
      const decimal2 = value / 100;
      
      let suggestedCorrection = '';
      if (decimal1 >= 3 && decimal1 <= 12) {
        suggestedCorrection = `${decimal1} mmol/L`;
      } else if (decimal2 >= 3 && decimal2 <= 12) {
        suggestedCorrection = `${decimal2} mmol/L`;
      }
      
      if (suggestedCorrection) {
        issues.push({
          severity: 'critical',
          type: 'ocr_decimal_error',
          message: `Cholesterol value ${value} mmol/L appears to be missing a decimal point.`,
          originalValue: match[0],
          suggestedCorrection,
          normalRange: '3.0-7.0 mmol/L',
          position: { start: match.index!, end: match.index! + match[0].length }
        });
      }
    }
  }
  
  return issues;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { originalText, translatedText, sourceLanguage, targetLanguage } = await req.json();
    
    if (!originalText && !translatedText) {
      return new Response(
        JSON.stringify({ error: 'No text provided for verification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log('Starting clinical verification...', {
      originalLength: originalText?.length || 0,
      translatedLength: translatedText?.length || 0,
      sourceLanguage,
      targetLanguage
    });
    
    // Extract medical values from both texts
    const originalValues = originalText ? extractMedicalValues(originalText) : [];
    const translatedValues = translatedText ? extractMedicalValues(translatedText) : [];
    
    // Validate medical values
    const originalIssues = originalText ? validateMedicalValues(originalValues, originalText) : [];
    const translatedIssues = translatedText ? validateMedicalValues(translatedValues, translatedText) : [];
    
    // Check for OCR errors
    const ocrIssues = originalText ? checkForCommonOCRErrors(originalText) : [];
    const translationOcrIssues = translatedText ? checkForCommonOCRErrors(translatedText) : [];
    
    // Combine all issues
    const allIssues = [
      ...originalIssues.map(issue => ({ ...issue, source: 'original' })),
      ...translatedIssues.map(issue => ({ ...issue, source: 'translated' })),
      ...ocrIssues.map(issue => ({ ...issue, source: 'original_ocr' })),
      ...translationOcrIssues.map(issue => ({ ...issue, source: 'translated_ocr' }))
    ];
    
    // Determine overall safety
    let overallSafety: 'safe' | 'warning' | 'unsafe' = 'safe';
    if (allIssues.some(issue => issue.severity === 'critical')) {
      overallSafety = 'unsafe';
    } else if (allIssues.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
      overallSafety = 'warning';
    }
    
    // Calculate confidence based on issues found
    const criticalIssues = allIssues.filter(issue => issue.severity === 'critical').length;
    const highIssues = allIssues.filter(issue => issue.severity === 'high').length;
    const mediumIssues = allIssues.filter(issue => issue.severity === 'medium').length;
    
    let confidence = 0.95;
    confidence -= criticalIssues * 0.3;
    confidence -= highIssues * 0.15;
    confidence -= mediumIssues * 0.05;
    confidence = Math.max(0.1, Math.min(1.0, confidence));
    
    const result: ClinicalVerificationResult = {
      hasIssues: allIssues.length > 0,
      issues: allIssues,
      detectedValues: [...originalValues, ...translatedValues],
      overallSafety,
      confidence
    };
    
    console.log(`Clinical verification completed. Found ${allIssues.length} issues, overall safety: ${overallSafety}`);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in clinical verification:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Clinical verification failed', 
        details: error.message,
        hasIssues: false,
        issues: [],
        detectedValues: [],
        overallSafety: 'safe',
        confidence: 0.5
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});