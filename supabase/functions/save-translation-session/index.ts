import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
  detectedIssues?: string[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    const {
      sessionId,
      translations,
      translationScores,
      sessionStart,
      sessionEnd,
      isActive
    } = await req.json();

    if (!translations || !Array.isArray(translations) || translations.length === 0) {
      throw new Error('Translations array is required and cannot be empty');
    }

    if (!sessionStart) {
      throw new Error('Session start time is required');
    }

    console.log('Processing translation session save:', {
      sessionId,
      translationsCount: translations.length,
      scoresCount: translationScores?.length || 0,
      sessionStart,
      sessionEnd,
      isActive
    });

    // Calculate session metadata
    const totalTranslations = translations.length;
    const averageAccuracy = translationScores?.length > 0 
      ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.accuracy, 0) / translationScores.length)
      : 95;
    
    const averageConfidence = translationScores?.length > 0
      ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.confidence, 0) / translationScores.length)
      : 95;

    const safeCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'safe').length || totalTranslations;
    const warningCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'warning').length || 0;
    const unsafeCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'unsafe').length || 0;
    
    let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe';
    if (unsafeCount > 0) {
      overallSafetyRating = 'unsafe';
    } else if (warningCount > totalTranslations * 0.3) {
      overallSafetyRating = 'warning';
    }

    const sessionDuration = sessionEnd 
      ? Math.floor((new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 1000)
      : undefined;

    // Detect primary patient language
    const patientLanguages = translations
      .filter((t: TranslationEntry) => t.speaker === 'patient')
      .map((t: TranslationEntry) => t.targetLanguage);
    
    const languageCount: { [key: string]: number } = {};
    patientLanguages.forEach((lang: string) => {
      languageCount[lang] = (languageCount[lang] || 0) + 1;
    });
    
    const primaryPatientLanguage = Object.entries(languageCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'english';

    const sessionMetadata = {
      totalTranslations,
      averageAccuracy,
      averageConfidence,
      overallSafetyRating,
      safeCount,
      warningCount,
      unsafeCount,
      sessionDuration,
      languages: Array.from(new Set([...patientLanguages, 'english']))
    };

    const sessionTitle = `Translation Session - ${new Date(sessionStart).toLocaleDateString()}`;

    let sessionData;

    if (sessionId) {
      // Update existing session
      console.log('Updating existing session:', sessionId);
      
      const { data, error } = await supabaseClient
        .from('translation_sessions')
        .update({
          session_end: sessionEnd || null,
          patient_language: primaryPatientLanguage,
          total_translations: totalTranslations,
          session_metadata: sessionMetadata,
          translations: JSON.stringify(translations),
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating session:', error);
        throw error;
      }

      sessionData = data;
    } else {
      // Create new session
      console.log('Creating new session for user:', user.id);
      
      const { data, error } = await supabaseClient
        .from('translation_sessions')
        .insert({
          user_id: user.id,
          session_title: sessionTitle,
          session_start: sessionStart,
          session_end: sessionEnd || null,
          patient_language: primaryPatientLanguage,
          total_translations: totalTranslations,
          session_metadata: sessionMetadata,
          translations: JSON.stringify(translations),
          is_active: isActive
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        throw error;
      }

      sessionData = data;
    }

    console.log('Session saved successfully:', sessionData.id);

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        message: sessionId ? 'Session updated successfully' : 'Session created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in save-translation-session:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});