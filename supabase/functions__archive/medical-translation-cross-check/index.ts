import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEEPL_API_KEY = Deno.env.get('DEEPL_API_KEY');
const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationResult {
  service: string;
  translatedText: string;
  confidence: number;
  detectedLanguage: string;
  medicalTermsPreserved: string[];
  warnings: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, targetLanguage = 'en', sourceLanguage = 'ro' } = await req.json();
    
    if (!originalText) {
      throw new Error('Original text is required');
    }

    console.log('Starting medical translation cross-check for text:', originalText.substring(0, 100) + '...');

    const translations: TranslationResult[] = [];

    // Google Translate
    if (GOOGLE_CLOUD_API_KEY) {
      try {
        const googleResult = await performGoogleTranslation(originalText, targetLanguage, sourceLanguage);
        translations.push(googleResult);
      } catch (error) {
        console.error('Google Translate failed:', error);
        translations.push({
          service: 'google_translate',
          translatedText: '',
          confidence: 0,
          detectedLanguage: sourceLanguage,
          medicalTermsPreserved: [],
          warnings: ['Google Translate failed: ' + error.message]
        });
      }
    }

    // DeepL Translation
    if (DEEPL_API_KEY) {
      try {
        const deeplResult = await performDeepLTranslation(originalText, targetLanguage, sourceLanguage);
        translations.push(deeplResult);
      } catch (error) {
        console.error('DeepL translation failed:', error);
        translations.push({
          service: 'deepl',
          translatedText: '',
          confidence: 0,
          detectedLanguage: sourceLanguage,
          medicalTermsPreserved: [],
          warnings: ['DeepL failed: ' + error.message]
        });
      }
    }

    // OpenAI Translation (medical-specific)
    if (OPENAI_API_KEY) {
      try {
        const openaiResult = await performOpenAITranslation(originalText, targetLanguage, sourceLanguage);
        translations.push(openaiResult);
      } catch (error) {
        console.error('OpenAI translation failed:', error);
        translations.push({
          service: 'openai',
          translatedText: '',
          confidence: 0,
          detectedLanguage: sourceLanguage,
          medicalTermsPreserved: [],
          warnings: ['OpenAI translation failed: ' + error.message]
        });
      }
    }

    // Perform cross-verification analysis
    const analysis = await analyzeCrossVerification(translations, originalText, sourceLanguage);
    
    // Perform reverse translation verification on the best result
    let reverseTranslationAnalysis = null;
    if (analysis.recommendedTranslation) {
      reverseTranslationAnalysis = await performReverseTranslationCheck(
        analysis.recommendedTranslation, 
        originalText, 
        targetLanguage, 
        sourceLanguage
      );
    }

    return new Response(JSON.stringify({
      translations,
      analysis,
      reverseTranslationAnalysis,
      overallConfidence: analysis.overallConfidence,
      medicalSafetyLevel: analysis.medicalSafetyLevel,
      recommendations: analysis.recommendations
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Medical translation cross-check error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      translations: [],
      overallConfidence: 0,
      medicalSafetyLevel: 'unsafe'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performGoogleTranslation(text: string, targetLang: string, sourceLang: string): Promise<TranslationResult> {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_CLOUD_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: sourceLang,
      format: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`Google Translate API error: ${response.status}`);
  }

  const data = await response.json();
  const translation = data.data.translations[0];
  
  const medicalTermsPreserved = checkMedicalTermPreservation(text, translation.translatedText);
  const warnings = validateMedicalTranslation(translation.translatedText, 'google_translate');

  return {
    service: 'google_translate',
    translatedText: translation.translatedText,
    confidence: 0.8, // Google doesn't provide confidence scores
    detectedLanguage: translation.detectedSourceLanguage || sourceLang,
    medicalTermsPreserved,
    warnings
  };
}

async function performDeepLTranslation(text: string, targetLang: string, sourceLang: string): Promise<TranslationResult> {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text: text,
      target_lang: targetLang.toUpperCase(),
      source_lang: sourceLang.toUpperCase()
    })
  });

  if (!response.ok) {
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  const translation = data.translations[0];
  
  const medicalTermsPreserved = checkMedicalTermPreservation(text, translation.text);
  const warnings = validateMedicalTranslation(translation.text, 'deepl');

  return {
    service: 'deepl',
    translatedText: translation.text,
    confidence: 0.85, // DeepL generally has high accuracy
    detectedLanguage: translation.detected_source_language?.toLowerCase() || sourceLang,
    medicalTermsPreserved,
    warnings
  };
}

async function performOpenAITranslation(text: string, targetLang: string, sourceLang: string): Promise<TranslationResult> {
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
          content: `You are a medical translation expert specializing in Romanian to English medical document translation. 

CRITICAL REQUIREMENTS:
1. Preserve all medical terminology accuracy
2. Maintain exact numerical values (doses, lab values, measurements)
3. Translate medication names correctly (e.g., "Atacand" not "Atocand")
4. Preserve medical procedure names accurately
5. Maintain professional medical document formatting
6. Flag any ambiguous terms that might need clarification

Translate the following medical text from ${sourceLang} to ${targetLang}. Only provide the translation, no explanations.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_completion_tokens: 2000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let translatedText = data.choices[0].message.content;
  
  // Remove surrounding quotes if present
  translatedText = translatedText.replace(/^["']|["']$/g, '');
  
  const medicalTermsPreserved = checkMedicalTermPreservation(text, translatedText);
  const warnings = validateMedicalTranslation(translatedText, 'openai');

  return {
    service: 'openai',
    translatedText,
    confidence: 0.9, // OpenAI with medical-specific prompts should be highly accurate
    detectedLanguage: sourceLang,
    medicalTermsPreserved,
    warnings
  };
}

function checkMedicalTermPreservation(original: string, translated: string): string[] {
  const medicalTermMappings = {
    'Atacand': ['Atacand', 'Candesartan'],
    'Atorvastatină': ['Atorvastatin'],
    'No-Spa': ['No-Spa', 'Drotaverine'],
    'mg': ['mg'],
    'mmol/L': ['mmol/L'],
    'colecistitâ': ['cholecystitis'],
    'cronică': ['chronic'],
    'litiazică': ['calculous', 'lithiasis'],
    'laparoscopico': ['laparoscopic'],
    'cholestectoromie': ['cholecystectomy']
  };

  const preserved: string[] = [];
  
  Object.entries(medicalTermMappings).forEach(([originalTerm, acceptableTranslations]) => {
    if (original.toLowerCase().includes(originalTerm.toLowerCase())) {
      const hasAcceptableTranslation = acceptableTranslations.some(translation => 
        translated.toLowerCase().includes(translation.toLowerCase())
      );
      if (hasAcceptableTranslation) {
        preserved.push(originalTerm);
      }
    }
  });

  return preserved;
}

function validateMedicalTranslation(translation: string, service: string): string[] {
  const warnings: string[] = [];

  // Check for medication name errors
  if (translation.includes('Atocand')) {
    warnings.push('Medication name error: "Atocand" should be "Atacand"');
  }

  // Check for suspicious numerical values
  const cholesterolMatch = translation.match(/cholesterol.*?(\d+\.?\d*)\s*(mmol\/L|mg\/dL)/i);
  if (cholesterolMatch) {
    const value = parseFloat(cholesterolMatch[1]);
    if (value > 50) {
      warnings.push(`Suspicious cholesterol value: ${value} - this seems too high`);
    }
  }

  // Check for duplicated phrases
  const duplicatePattern = /(.{10,})\s+\1/gi;
  if (duplicatePattern.test(translation)) {
    warnings.push('Duplicated phrases detected in translation');
  }

  // Check for incomplete medical terms
  if (translation.includes('ngctalulu') || translation.includes('biliară with')) {
    warnings.push('Incomplete or corrupted medical terminology detected');
  }

  return warnings;
}

async function analyzeCrossVerification(translations: TranslationResult[], originalText: string, sourceLanguage: string) {
  const validTranslations = translations.filter(t => t.translatedText && t.translatedText.trim().length > 0);
  
  if (validTranslations.length === 0) {
    return {
      recommendedTranslation: '',
      overallConfidence: 0,
      medicalSafetyLevel: 'unsafe',
      agreement: 0,
      recommendations: ['No valid translations obtained - manual review required']
    };
  }

  // Calculate agreement between services
  const agreement = calculateTranslationAgreement(validTranslations);
  
  // Find the translation with highest confidence and fewest warnings
  const bestTranslation = validTranslations.reduce((prev, current) => {
    const prevScore = prev.confidence - (prev.warnings.length * 0.1);
    const currentScore = current.confidence - (current.warnings.length * 0.1);
    return prevScore > currentScore ? prev : current;
  });

  // Determine overall confidence and safety level
  const overallConfidence = Math.min(bestTranslation.confidence, agreement);
  const medicalSafetyLevel = determineMedicalSafetyLevel(validTranslations, agreement);
  const recommendations = generateRecommendations(validTranslations, agreement, overallConfidence);

  return {
    recommendedTranslation: bestTranslation.translatedText,
    bestService: bestTranslation.service,
    overallConfidence,
    medicalSafetyLevel,
    agreement,
    recommendations,
    allWarnings: validTranslations.flatMap(t => t.warnings)
  };
}

function calculateTranslationAgreement(translations: TranslationResult[]): number {
  if (translations.length < 2) return 1;

  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < translations.length; i++) {
    for (let j = i + 1; j < translations.length; j++) {
      const similarity = calculateStringSimilarity(
        translations[i].translatedText, 
        translations[j].translatedText
      );
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
}

function determineMedicalSafetyLevel(translations: TranslationResult[], agreement: number): string {
  const hasHighRiskWarnings = translations.some(t => 
    t.warnings.some(w => 
      w.includes('Suspicious') || 
      w.includes('error') || 
      w.includes('corrupted')
    )
  );

  if (hasHighRiskWarnings || agreement < 0.6) {
    return 'unsafe';
  } else if (agreement < 0.8) {
    return 'warning';
  } else {
    return 'safe';
  }
}

function generateRecommendations(translations: TranslationResult[], agreement: number, confidence: number): string[] {
  const recommendations: string[] = [];

  if (confidence < 0.7) {
    recommendations.push('Manual medical review strongly recommended due to low confidence');
  }

  if (agreement < 0.6) {
    recommendations.push('Translation services disagree significantly - expert review required');
  }

  const hasWarnings = translations.some(t => t.warnings.length > 0);
  if (hasWarnings) {
    recommendations.push('Review all flagged warnings before using translation');
  }

  if (recommendations.length === 0) {
    recommendations.push('Translation appears accurate - routine verification recommended');
  }

  return recommendations;
}

async function performReverseTranslationCheck(translatedText: string, originalText: string, fromLang: string, toLang: string) {
  try {
    // Translate back to original language
    const reverseTranslation = await performGoogleTranslation(translatedText, toLang, fromLang);
    
    // Compare with original
    const similarity = calculateStringSimilarity(originalText, reverseTranslation.translatedText);
    
    return {
      reverseTranslatedText: reverseTranslation.translatedText,
      similarity,
      isAccurate: similarity > 0.7,
      warnings: similarity < 0.5 ? ['Reverse translation differs significantly from original'] : []
    };
  } catch (error) {
    return {
      reverseTranslatedText: '',
      similarity: 0,
      isAccurate: false,
      warnings: ['Reverse translation check failed: ' + error.message]
    };
  }
}