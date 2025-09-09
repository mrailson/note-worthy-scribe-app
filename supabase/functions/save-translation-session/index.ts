import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  accuracy?: number;
  confidence?: number;
  safetyFlag?: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected?: string[];
  translationLatency?: number;
}

interface TranslationScore {
  accuracy: number;
  confidence: number;
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  detectedIssues: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { sessionId, translations, translationScores, sessionStart, sessionEnd, isActive } = await req.json()

    if (!translations || !Array.isArray(translations)) {
      throw new Error('Invalid translations data')
    }

    // Generate session title based on languages and content
    const languages = [...new Set(translations.map(t => t.targetLanguage))].filter(Boolean)
    const languageText = languages.length > 1 ? `Multi-language (${languages.join(', ')})` : languages[0] || 'Unknown'
    const sessionTitle = `${languageText} Session (${translations.length} translations)`

    // Determine primary patient language
    const primaryLanguage = languages.length > 0 ? languages[0] : 'multiple'

    // Calculate session metadata
    const totalTranslations = translations.length
    const averageAccuracy = translationScores.length > 0 
      ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.accuracy, 0) / translationScores.length)
      : 0
    const averageConfidence = translationScores.length > 0
      ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.confidence, 0) / translationScores.length)
      : 0

    const safeCount = translationScores.filter(s => s.safetyFlag === 'safe').length
    const warningCount = translationScores.filter(s => s.safetyFlag === 'warning').length
    const unsafeCount = translationScores.filter(s => s.safetyFlag === 'unsafe').length

    let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe'
    if (unsafeCount > 0) {
      overallSafetyRating = 'unsafe'
    } else if (warningCount > totalTranslations * 0.3) {
      overallSafetyRating = 'warning'
    }

    const sessionMetadata = {
      totalTranslations,
      averageAccuracy,
      averageConfidence,
      overallSafetyRating,
      safeCount,
      warningCount,
      unsafeCount,
      sessionDuration: sessionEnd ? Math.floor((new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 1000) : null,
      languages
    }

    if (sessionId) {
      // Update existing session
      const { data, error } = await supabase
        .from('translation_sessions')
        .update({
          translations: JSON.stringify(translations),
          translation_scores: JSON.stringify(translationScores),
          session_end: sessionEnd ? new Date(sessionEnd).toISOString() : null,
          total_translations: totalTranslations,
          session_metadata: sessionMetadata,
          is_active: isActive !== false,
          patient_language: primaryLanguage,
          session_title: sessionTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          success: true, 
          session: data,
          message: 'Translation session updated successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('translation_sessions')
        .insert({
          user_id: user.id,
          session_title: sessionTitle,
          session_start: new Date(sessionStart).toISOString(),
          session_end: sessionEnd ? new Date(sessionEnd).toISOString() : null,
          patient_language: primaryLanguage,
          total_translations: totalTranslations,
          translations: JSON.stringify(translations),
          translation_scores: JSON.stringify(translationScores),
          session_metadata: sessionMetadata,
          is_active: isActive !== false
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          success: true, 
          session: data,
          message: 'Translation session saved successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Save translation session error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to save translation session',
        details: 'Translation session save failed'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})