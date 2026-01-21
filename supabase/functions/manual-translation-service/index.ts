import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  isToEnglish?: boolean;
}

interface TranslationResponse {
  translatedText: string;
  accuracy: number;
  confidence: number;
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  medicalTermsCount: number;
  processingTimeMs: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { text, sourceLanguage, targetLanguage, isToEnglish }: TranslationRequest = await req.json();
    
    console.log('🔄 Manual translation request:', {
      text: text.substring(0, 100),
      sourceLanguage,
      targetLanguage,
      isToEnglish
    });

    if (!text || !text.trim()) {
      throw new Error('Text is required for translation');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    // Prepare translation request for OpenAI
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Detect medical terms
    const medicalTerms = detectMedicalTerms(text);
    const safetyFlag = assessSafety(text, medicalTerms);

    // Create system prompt for general translation
    const systemPrompt = `You are a professional translator providing accurate translations for any type of conversation. 
    
    Guidelines:
    - Provide accurate, clear translations that preserve the original meaning
    - Maintain the tone and context of the conversation
    - Use appropriate terminology for the target language
    - Preserve any technical terms or specific terminology accurately
    - Use natural, fluent language appropriate for the context
    
    Source language: ${sourceLanguage}
    Target language: ${targetLanguage}
    
    Translate the following text accurately:`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use real OpenAI model for translation
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_completion_tokens: 500 // Updated parameter name for newer models
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(`Translation service error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    let translatedText = openAIData.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('No translation received from service');
    }

    // Remove surrounding quotes if present
    translatedText = translatedText.replace(/^["']|["']$/g, '');

    const processingTime = Date.now() - startTime;

    // Calculate quality metrics
    const accuracy = calculateAccuracy(text, translatedText, medicalTerms.length);
    const confidence = calculateConfidence(text, translatedText);

    const response: TranslationResponse = {
      translatedText,
      accuracy,
      confidence,
      safetyFlag,
      medicalTermsDetected: medicalTerms,
      medicalTermsCount: medicalTerms.length,
      processingTimeMs: processingTime
    };

    console.log('✅ Translation completed:', {
      originalLength: text.length,
      translatedLength: translatedText.length,
      accuracy,
      confidence,
      safetyFlag,
      medicalTermsCount: medicalTerms.length,
      processingTime
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manual translation error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Translation failed',
      translatedText: '',
      accuracy: 0,
      confidence: 0,
      safetyFlag: 'unsafe' as const,
      medicalTermsDetected: [],
      medicalTermsCount: 0,
      processingTimeMs: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to detect medical terms
function detectMedicalTerms(text: string): string[] {
  const medicalKeywords = [
    'pain', 'medication', 'prescription', 'tablet', 'dose', 'symptoms', 'diagnosis',
    'treatment', 'blood', 'pressure', 'heart', 'chest', 'breathing', 'headache',
    'infection', 'allergy', 'diabetes', 'asthma', 'surgery', 'hospital', 'doctor',
    'nurse', 'appointment', 'test', 'scan', 'x-ray', 'injection', 'vaccine',
    'temperature', 'fever', 'nausea', 'vomiting', 'diarrhoea', 'constipation'
  ];

  const lowerText = text.toLowerCase();
  return medicalKeywords.filter(term => lowerText.includes(term));
}

// Helper function to assess safety
function assessSafety(text: string, medicalTerms: string[]): 'safe' | 'warning' | 'unsafe' {
  const lowerText = text.toLowerCase();
  
  // High-risk terms
  const highRiskTerms = ['emergency', 'urgent', 'severe', 'critical', 'overdose', 'suicide', 'chest pain'];
  const hasHighRisk = highRiskTerms.some(term => lowerText.includes(term));
  
  if (hasHighRisk) {
    return 'unsafe';
  }
  
  // Warning for multiple medical terms or complex medical language
  if (medicalTerms.length >= 3) {
    return 'warning';
  }
  
  return 'safe';
}

// Helper function to calculate translation accuracy
function calculateAccuracy(original: string, translated: string, medicalTermsCount: number): number {
  // Base accuracy starts at 85%
  let accuracy = 85;
  
  // Penalise very short translations (likely incomplete)
  if (translated.length < original.length * 0.5) {
    accuracy -= 15;
  }
  
  // Bonus for medical content (more careful translation)
  if (medicalTermsCount > 0) {
    accuracy += Math.min(10, medicalTermsCount * 2);
  }
  
  // Ensure accuracy is between 60-95%
  return Math.max(60, Math.min(95, accuracy));
}

// Helper function to calculate confidence
function calculateConfidence(original: string, translated: string): number {
  // Base confidence
  let confidence = 80;
  
  // Higher confidence for reasonable length translations
  const lengthRatio = translated.length / original.length;
  if (lengthRatio >= 0.7 && lengthRatio <= 1.5) {
    confidence += 10;
  }
  
  // Slight bonus for longer, more detailed text
  if (original.length > 50) {
    confidence += 5;
  }
  
  return Math.max(70, Math.min(95, confidence));
}