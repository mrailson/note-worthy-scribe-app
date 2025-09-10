// Medical Safety Utilities for preventing AI fabrication of medical information

export interface MedicalSafetyCheck {
  isSafe: boolean;
  hasRestrictedTerms: boolean;
  flaggedTerms: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

// Medical keywords that should trigger safety checks
const RESTRICTED_MEDICAL_TERMS = [
  // Blood tests and lab values
  'blood test', 'lab results', 'hemoglobin', 'glucose', 'cholesterol', 'hba1c', 'creatinine',
  'urea', 'electrolytes', 'liver function', 'thyroid', 'psa', 'inflammatory markers',
  'white blood cell', 'red blood cell', 'platelet', 'mcv', 'mch', 'mchc', 'esr', 'crp',
  
  // Diagnoses and conditions
  'diagnosis', 'diagnosed with', 'condition', 'disease', 'disorder', 'syndrome',
  'cancer', 'diabetes', 'hypertension', 'depression', 'anxiety', 'infection',
  'pneumonia', 'covid', 'flu', 'heart disease', 'stroke', 'asthma', 'copd',
  
  // Medications and treatments
  'medication', 'tablet', 'capsule', 'injection', 'dosage', 'mg', 'ml',
  'prescription', 'antibiotic', 'painkiller', 'insulin', 'metformin', 'aspirin',
  'treatment plan', 'therapy', 'surgery', 'operation', 'procedure',
  
  // Clinical measurements
  'blood pressure', 'heart rate', 'temperature', 'oxygen saturation', 'bmi',
  'weight', 'height', 'pulse', 'mmhg', 'celsius', 'fahrenheit', '%', 'kg', 'cm',
  
  // Medical assessments
  'normal range', 'abnormal', 'elevated', 'decreased', 'high', 'low', 'positive', 'negative',
  'test result', 'scan result', 'x-ray', 'ultrasound', 'mri', 'ct scan', 'ecg', 'echo',
  
  // Clinical advice
  'medical advice', 'follow up', 'monitor', 'retest', 'urgent', 'emergency',
  'see doctor', 'gp appointment', 'specialist referral', 'hospital admission'
];

// Emergency medical terms that should immediately flag content
const HIGH_RISK_TERMS = [
  'emergency', 'urgent', 'critical', 'life threatening', 'cardiac arrest',
  'stroke', 'heart attack', 'overdose', 'poisoning', 'severe bleeding',
  'unconscious', 'difficulty breathing', 'chest pain', 'severe pain'
];

/**
 * Validates voice input to ensure it doesn't contain medical information
 * that could lead to AI fabrication
 */
export const validateVoiceInput = (voiceText: string): MedicalSafetyCheck => {
  const lowerText = voiceText.toLowerCase();
  const flaggedTerms: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Check for high-risk emergency terms
  for (const term of HIGH_RISK_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      flaggedTerms.push(term);
      riskLevel = 'high';
    }
  }

  // Check for restricted medical terms
  for (const term of RESTRICTED_MEDICAL_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      flaggedTerms.push(term);
      if (riskLevel !== 'high') {
        riskLevel = 'medium';
      }
    }
  }

  const hasRestrictedTerms = flaggedTerms.length > 0;
  const isSafe = !hasRestrictedTerms || riskLevel === 'low';

  let recommendation = '';
  if (riskLevel === 'high') {
    recommendation = 'STOP: This input contains emergency medical terms. Manual review required before AI generation.';
  } else if (riskLevel === 'medium') {
    recommendation = 'WARNING: This input contains medical terms. Ensure AI does not fabricate medical information.';
  } else {
    recommendation = 'Safe for AI generation with standard administrative guidelines.';
  }

  return {
    isSafe,
    hasRestrictedTerms,
    flaggedTerms,
    riskLevel,
    recommendation
  };
};

/**
 * Validates AI-generated content to check for medical fabrication
 */
export const validateGeneratedContent = (content: string, originalInput?: string): MedicalSafetyCheck => {
  const lowerContent = content.toLowerCase();
  const flaggedTerms: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Check if the AI generated medical content not in the original input
  for (const term of RESTRICTED_MEDICAL_TERMS) {
    if (lowerContent.includes(term.toLowerCase())) {
      // If we have original input, check if this term was already there
      if (originalInput) {
        const originalLower = originalInput.toLowerCase();
        if (!originalLower.includes(term.toLowerCase())) {
          flaggedTerms.push(term);
          riskLevel = 'high'; // Any fabricated medical content is high risk
        }
      } else {
        flaggedTerms.push(term);
        riskLevel = 'medium';
      }
    }
  }

  // Check for medical values/numbers that suggest fabrication
  const medicalValuePattern = /\b\d+\s*(mg|ml|mmhg|celsius|%|kg|cm|g\/dl|mmol\/l)\b/gi;
  const medicalValues = content.match(medicalValuePattern);
  if (medicalValues && medicalValues.length > 0) {
    flaggedTerms.push(...medicalValues);
    riskLevel = 'high';
  }

  const hasRestrictedTerms = flaggedTerms.length > 0;
  const isSafe = riskLevel === 'low';

  let recommendation = '';
  if (riskLevel === 'high') {
    recommendation = 'CRITICAL: AI has fabricated medical information. Content must be manually reviewed and edited before use.';
  } else if (riskLevel === 'medium') {
    recommendation = 'WARNING: Content contains medical terms. Verify accuracy before use.';
  } else {
    recommendation = 'Content appears safe for administrative use.';
  }

  return {
    isSafe,
    hasRestrictedTerms,
    flaggedTerms,
    riskLevel,
    recommendation
  };
};

/**
 * Creates a safe prompt for AI generation that emphasizes medical safety
 */
export const createSafeMedicalPrompt = (basePrompt: string, voiceInput?: string): string => {
  const safetyPrefix = `
🚨 MEDICAL SAFETY PROTOCOL - MANDATORY COMPLIANCE:
- NEVER fabricate, invent, or create medical information
- NEVER generate test results, lab values, or medical measurements  
- NEVER suggest diagnoses, treatments, or medical advice
- ONLY use information explicitly provided in the input
- Focus on administrative and non-clinical correspondence only
- If medical information is needed but not provided, state "Requires clinical review"

ADMINISTRATIVE RESPONSE ONLY:
`;

  return safetyPrefix + basePrompt + (voiceInput ? `\n\nVoice Instructions (Administrative Only): ${voiceInput}` : '');
};