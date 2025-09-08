// Translation scoring and safety assessment utilities

export interface TranslationScore {
  accuracy: number; // 0-100
  confidence: number; // 0-100  
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  issues: string[];
}

// Common medical terms that require careful translation
const MEDICAL_TERMS = [
  'chest pain', 'breathing', 'dizzy', 'nausea', 'vomiting', 'fever', 
  'headache', 'allergic', 'medicine', 'prescription', 'dosage', 
  'symptom', 'diagnosis', 'treatment', 'surgery', 'blood pressure',
  'diabetes', 'asthma', 'heart', 'lung', 'kidney', 'liver',
  'emergency', 'urgent', 'pain', 'infection', 'disease', 'condition'
];

// High-risk medical terms that require extra caution
const HIGH_RISK_TERMS = [
  'emergency', 'urgent', 'chest pain', 'can\'t breathe', 'allergic reaction',
  'overdose', 'suicide', 'bleeding', 'unconscious', 'seizure', 'stroke'
];

// Phrases that might indicate translation quality issues
const QUALITY_INDICATORS = {
  good: [
    'specific medical terms preserved',
    'grammatically correct',
    'culturally appropriate',
    'context maintained'
  ],
  concerning: [
    'literal translation detected',
    'medical context lost',
    'cultural nuance missing',
    'unclear meaning'
  ]
};

/**
 * Calculates translation accuracy based on various factors
 */
export function calculateTranslationAccuracy(
  originalText: string,
  translatedText: string,
  originalLanguage: string,
  targetLanguage: string
): number {
  let accuracyScore = 100;
  
  // Length-based assessment (very basic heuristic)
  const lengthRatio = translatedText.length / originalText.length;
  if (lengthRatio < 0.5 || lengthRatio > 2.5) {
    accuracyScore -= 20; // Suspicious length difference
  }
  
  // Check for preserved medical terms
  const originalMedicalTerms = detectMedicalTerms(originalText.toLowerCase());
  const translatedMedicalTerms = detectMedicalTerms(translatedText.toLowerCase());
  
  if (originalMedicalTerms.length > 0) {
    // Medical terms should be handled carefully
    const preservationRatio = translatedMedicalTerms.length / originalMedicalTerms.length;
    if (preservationRatio < 0.5) {
      accuracyScore -= 15; // Medical terms not properly preserved
    }
  }
  
  // Check for obvious translation issues
  if (translatedText.includes('undefined') || translatedText.includes('null')) {
    accuracyScore -= 30;
  }
  
  // Empty or very short translations are suspicious
  if (translatedText.trim().length < 3) {
    accuracyScore -= 50;
  }
  
  // Same language check
  if (originalLanguage === targetLanguage && originalText === translatedText) {
    accuracyScore = 100; // Perfect for same language
  }
  
  return Math.max(0, Math.min(100, accuracyScore));
}

/**
 * Calculates confidence score based on various factors
 */
export function calculateConfidenceScore(
  originalText: string,
  translatedText: string,
  processingTime: number
): number {
  let confidenceScore = 85; // Start with good baseline
  
  // Processing time factor
  if (processingTime > 5000) { // More than 5 seconds
    confidenceScore -= 10;
  } else if (processingTime < 500) { // Less than 500ms might be too fast
    confidenceScore -= 5;
  }
  
  // Text complexity factor
  const wordCount = originalText.split(' ').length;
  if (wordCount > 50) {
    confidenceScore -= 5; // Longer texts are harder to translate accurately
  }
  
  // Special characters and formatting
  const hasNumbers = /\d/.test(originalText);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(originalText);
  
  if (hasNumbers && hasSpecialChars) {
    confidenceScore -= 5; // Complex formatting can affect translation
  }
  
  return Math.max(0, Math.min(100, confidenceScore));
}

/**
 * Determines safety flag based on content analysis
 */
export function assessTranslationSafety(
  originalText: string,
  translatedText: string,
  accuracy: number,
  confidence: number
): 'safe' | 'warning' | 'unsafe' {
  const originalLower = originalText.toLowerCase();
  const translatedLower = translatedText.toLowerCase();
  
  // Check for high-risk medical terms
  const hasHighRiskTerms = HIGH_RISK_TERMS.some(term => 
    originalLower.includes(term) || translatedLower.includes(term)
  );
  
  // Low accuracy or confidence is a safety concern
  if (accuracy < 70 || confidence < 70) {
    return hasHighRiskTerms ? 'unsafe' : 'warning';
  }
  
  // Very low scores are always unsafe
  if (accuracy < 50 || confidence < 50) {
    return 'unsafe';
  }
  
  // High-risk terms with decent accuracy still get warning
  if (hasHighRiskTerms && (accuracy < 85 || confidence < 85)) {
    return 'warning';
  }
  
  // Check for translation quality issues
  if (translatedText.includes('undefined') || translatedText.includes('null') || translatedText.trim().length < 3) {
    return 'unsafe';
  }
  
  return 'safe';
}

/**
 * Detects medical terms in text
 */
export function detectMedicalTerms(text: string): string[] {
  const lowerText = text.toLowerCase();
  return MEDICAL_TERMS.filter(term => lowerText.includes(term));
}

/**
 * Comprehensive translation scoring
 */
export function scoreTranslation(
  originalText: string,
  translatedText: string,
  originalLanguage: string,
  targetLanguage: string,
  processingTime: number = 1000
): TranslationScore {
  const accuracy = calculateTranslationAccuracy(originalText, translatedText, originalLanguage, targetLanguage);
  const confidence = calculateConfidenceScore(originalText, translatedText, processingTime);
  const safetyFlag = assessTranslationSafety(originalText, translatedText, accuracy, confidence);
  const medicalTermsDetected = [
    ...detectMedicalTerms(originalText),
    ...detectMedicalTerms(translatedText)
  ];
  
  // Remove duplicates
  const uniqueMedicalTerms = [...new Set(medicalTermsDetected)];
  
  // Generate issues list
  const issues: string[] = [];
  
  if (accuracy < 80) {
    issues.push('Translation accuracy below recommended threshold');
  }
  
  if (confidence < 80) {
    issues.push('Low confidence in translation quality');
  }
  
  if (uniqueMedicalTerms.length > 0 && accuracy < 90) {
    issues.push('Medical terminology requires verification');
  }
  
  if (safetyFlag === 'unsafe') {
    issues.push('Translation flagged as potentially unsafe');
  }
  
  if (processingTime > 5000) {
    issues.push('Slow processing time may indicate complexity');
  }
  
  return {
    accuracy,
    confidence,
    safetyFlag,
    medicalTermsDetected: uniqueMedicalTerms,
    issues
  };
}

/**
 * Generates overall session assessment
 */
export function assessSessionSafety(scores: TranslationScore[]): {
  overallRating: 'safe' | 'warning' | 'unsafe';
  recommendations: string[];
  riskFactors: string[];
} {
  if (scores.length === 0) {
    return {
      overallRating: 'safe',
      recommendations: ['No translations to assess'],
      riskFactors: []
    };
  }
  
  const unsafeCount = scores.filter(s => s.safetyFlag === 'unsafe').length;
  const warningCount = scores.filter(s => s.safetyFlag === 'warning').length;
  const averageAccuracy = scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length;
  const averageConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
  
  let overallRating: 'safe' | 'warning' | 'unsafe' = 'safe';
  const recommendations: string[] = [];
  const riskFactors: string[] = [];
  
  // Determine overall rating
  if (unsafeCount > 0) {
    overallRating = 'unsafe';
    riskFactors.push(`${unsafeCount} unsafe translations detected`);
  } else if (warningCount > scores.length * 0.3) {
    overallRating = 'warning';
    riskFactors.push(`High number of warning-level translations (${warningCount})`);
  }
  
  // Check averages
  if (averageAccuracy < 80) {
    overallRating = overallRating === 'safe' ? 'warning' : overallRating;
    riskFactors.push(`Low average accuracy (${averageAccuracy.toFixed(1)}%)`);
  }
  
  if (averageConfidence < 80) {
    overallRating = overallRating === 'safe' ? 'warning' : overallRating;
    riskFactors.push(`Low average confidence (${averageConfidence.toFixed(1)}%)`);
  }
  
  // Generate recommendations
  if (overallRating === 'unsafe') {
    recommendations.push('Review unsafe translations immediately with qualified medical interpreter');
    recommendations.push('Consider follow-up appointment with professional interpretation services');
  } else if (overallRating === 'warning') {
    recommendations.push('Verify key medical information with patient in their native language');
    recommendations.push('Consider additional confirmation of critical health information');
  } else {
    recommendations.push('Translation quality appears acceptable for basic communication');
    recommendations.push('Continue monitoring translation accuracy for medical discussions');
  }
  
  // Check for medical terms
  const allMedicalTerms = scores.flatMap(s => s.medicalTermsDetected);
  if (allMedicalTerms.length > 0) {
    recommendations.push('Medical terminology was detected - verify understanding with patient');
  }
  
  return {
    overallRating,
    recommendations,
    riskFactors
  };
}