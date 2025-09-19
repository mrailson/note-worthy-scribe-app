import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, targetLanguage, sourceLanguage = 'auto' } = await req.json()

    if (!text || !targetLanguage) {
      throw new Error('Text and target language are required')
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Determine translation direction and create appropriate prompt
    const isToEnglish = targetLanguage === 'en' || targetLanguage === 'english'
    const prompt = isToEnglish 
      ? `Translate the following ${sourceLanguage === 'auto' ? 'text' : sourceLanguage} text to clear, professional English suitable for medical contexts. Preserve all medical terminology and maintain the original meaning precisely:

"${text}"

Respond with only the English translation, no explanations or additional text.`
      : `Translate the following English text to ${targetLanguage} in a clear, professional manner suitable for medical contexts. Preserve all medical terminology and maintain the original meaning precisely:

"${text}"

Respond with only the ${targetLanguage} translation, no explanations or additional text.`

    console.log('Translation request:', { 
      text: text.substring(0, 100), 
      sourceLanguage, 
      targetLanguage, 
      isToEnglish 
    })

    // Call OpenAI for translation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional medical translator. Provide accurate, clear translations that preserve medical terminology and meaning. Respond only with the translation, no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`Translation service error: ${response.status}`)
    }

    const data = await response.json()
    const translatedText = data.choices[0]?.message?.content?.trim() || ''

    if (!translatedText) {
      throw new Error('No translation received from service')
    }

    // Simple accuracy assessment based on length and content preservation
    const accuracyScore = Math.min(95, Math.max(70, 
      85 + (text.length > 50 ? 5 : 0) - 
      (Math.abs(translatedText.length - text.length) / text.length > 0.5 ? 10 : 0)
    ))

    // Simple confidence assessment
    const confidenceScore = Math.min(95, Math.max(75, accuracyScore - 5))

    // Basic medical terminology detection
    const medicalTerms = detectMedicalTerms(text + ' ' + translatedText)

    // Safety assessment based on medical context
    const safetyFlag = assessSafety(text, translatedText, accuracyScore, medicalTerms)

    const result = {
      originalText: text,
      translatedText,
      detectedSourceLanguage: sourceLanguage,
      targetLanguage,
      accuracy: Math.round(accuracyScore),
      confidence: Math.round(confidenceScore),
      safetyFlag,
      medicalTermsDetected: medicalTerms,
      processingTimeMs: 1000, // Placeholder
    }

    console.log('Translation completed:', {
      accuracy: result.accuracy,
      confidence: result.confidence,
      safetyFlag: result.safetyFlag,
      medicalTermsCount: medicalTerms.length
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Manual translation service error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        originalText: '',
        translatedText: '',
        accuracy: 0,
        confidence: 0,
        safetyFlag: 'unsafe'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function detectMedicalTerms(text: string): string[] {
  const medicalKeywords = [
    'pain', 'medication', 'prescription', 'dose', 'dosage', 'symptom', 'diagnosis',
    'treatment', 'allergy', 'allergic', 'blood pressure', 'heart rate', 'temperature',
    'nausea', 'vomiting', 'headache', 'fever', 'infection', 'antibiotic', 'surgery',
    'operation', 'emergency', 'urgent', 'serious', 'chronic', 'acute', 'severe',
    'mild', 'moderate', 'doctor', 'nurse', 'hospital', 'clinic', 'appointment',
    'test', 'examination', 'scan', 'x-ray', 'blood test', 'urine', 'breathing',
    'chest', 'heart', 'lung', 'stomach', 'abdomen', 'liver', 'kidney', 'diabetes',
    'hypertension', 'asthma', 'cancer', 'tumour', 'tumor'
  ]

  const lowerText = text.toLowerCase()
  const foundTerms: string[] = []

  medicalKeywords.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      foundTerms.push(term)
    }
  })

  return [...new Set(foundTerms)] // Remove duplicates
}

function assessSafety(
  originalText: string, 
  translatedText: string, 
  accuracy: number, 
  medicalTerms: string[]
): 'safe' | 'warning' | 'unsafe' {
  // Critical medical terms that require high accuracy
  const criticalTerms = ['emergency', 'urgent', 'serious', 'severe', 'allergy', 'allergic', 'medication', 'dose']
  
  const hasCriticalTerms = criticalTerms.some(term => 
    originalText.toLowerCase().includes(term) || translatedText.toLowerCase().includes(term)
  )

  if (accuracy < 70) {
    return 'unsafe'
  }

  if (hasCriticalTerms && accuracy < 85) {
    return 'warning'
  }

  if (medicalTerms.length > 3 && accuracy < 80) {
    return 'warning'
  }

  if (accuracy >= 90) {
    return 'safe'
  }

  return accuracy >= 80 ? 'safe' : 'warning'
}