import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, ...params } = body

    switch (action) {
      case 'save':
        return await handleSave(supabaseUrl, user, params, authHeader, corsHeaders)
      case 'load':
        return await handleLoad(supabase, user, params, corsHeaders)
      case 'update':
        return await handleUpdate(supabase, user, params, corsHeaders)
      case 'delete':
        return await handleDelete(supabase, user, params, corsHeaders)
      case 'clear':
        return await handleClear(supabase, user, corsHeaders)
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('translation-session-manager error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── SAVE ────────────────────────────────────────────────────────────────────
// Uses ANON key + user JWT to respect RLS (same as original save-translation-session)
async function handleSave(
  supabaseUrl: string,
  user: any,
  params: any,
  authHeader: string,
  corsHeaders: Record<string, string>
) {
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    sessionId,
    translations,
    translationScores,
    sessionStart,
    sessionEnd,
    isActive
  } = params

  if (!translations || !Array.isArray(translations) || translations.length === 0) {
    throw new Error('Translations array is required and cannot be empty')
  }

  if (!sessionStart) {
    throw new Error('Session start time is required')
  }

  console.log('Processing translation session save:', {
    sessionId,
    translationsCount: translations.length,
    scoresCount: translationScores?.length || 0,
    sessionStart,
    sessionEnd,
    isActive
  })

  // Calculate session metadata
  const totalTranslations = translations.length
  const averageAccuracy = translationScores?.length > 0
    ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.accuracy, 0) / translationScores.length)
    : 95

  const averageConfidence = translationScores?.length > 0
    ? Math.round(translationScores.reduce((sum: number, s: TranslationScore) => sum + s.confidence, 0) / translationScores.length)
    : 95

  const safeCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'safe').length || totalTranslations
  const warningCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'warning').length || 0
  const unsafeCount = translationScores?.filter((s: TranslationScore) => s.safetyFlag === 'unsafe').length || 0

  let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe'
  if (unsafeCount > 0) {
    overallSafetyRating = 'unsafe'
  } else if (warningCount > totalTranslations * 0.3) {
    overallSafetyRating = 'warning'
  }

  const sessionDuration = sessionEnd
    ? Math.floor((new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 1000)
    : undefined

  // Detect primary patient language
  const patientLanguages = translations
    .filter((t: TranslationEntry) => t.speaker === 'patient')
    .map((t: TranslationEntry) => t.targetLanguage)

  const languageCount: { [key: string]: number } = {}
  patientLanguages.forEach((lang: string) => {
    languageCount[lang] = (languageCount[lang] || 0) + 1
  })

  const primaryPatientLanguage = Object.entries(languageCount)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'english'

  const sessionMetadata = {
    totalTranslations,
    averageAccuracy,
    averageConfidence,
    overallSafetyRating,
    safeCount,
    warningCount,
    unsafeCount,
    sessionDuration,
    translationType: 'Live Speech Translation',
    languages: Array.from(new Set([...patientLanguages, 'english']))
  }

  const sessionTitle = `Translation Session - ${new Date(sessionStart).toLocaleDateString()}`

  let sessionData

  if (sessionId) {
    console.log('Updating existing session:', sessionId)

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
      .single()

    if (error) {
      console.error('Error updating session:', error)
      throw error
    }

    sessionData = data
  } else {
    console.log('Creating new session for user:', user.id)

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
      .single()

    if (error) {
      console.error('Error creating session:', error)
      throw error
    }

    sessionData = data
  }

  console.log('Session saved successfully:', sessionData.id)

  return new Response(
    JSON.stringify({
      success: true,
      session: sessionData,
      message: sessionId ? 'Session updated successfully' : 'Session created successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ─── LOAD ────────────────────────────────────────────────────────────────────
async function handleLoad(
  supabase: any,
  user: any,
  params: any,
  corsHeaders: Record<string, string>
) {
  const limit = parseInt(params.limit || '50')
  const offset = parseInt(params.offset || '0')
  const flaggedOnly = params.flagged
  const protectedOnly = params.protected
  const language = params.language
  const search = params.search

  let query = supabase
    .from('translation_sessions')
    .select(`
      id,
      session_title,
      session_start,
      session_end,
      patient_language,
      total_translations,
      session_metadata,
      created_at,
      updated_at,
      is_flagged,
      is_protected,
      is_active
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (flaggedOnly) {
    query = query.eq('is_flagged', true)
  }

  if (protectedOnly) {
    query = query.eq('is_protected', true)
  }

  if (language && language !== 'all') {
    query = query.eq('patient_language', language)
  }

  if (search) {
    query = query.ilike('session_title', `%${search}%`)
  }

  query = query.range(offset, offset + limit - 1)

  const { data: sessions, error } = await query

  if (error) throw error

  // Get total count for pagination
  let countQuery = supabase
    .from('translation_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (flaggedOnly) {
    countQuery = countQuery.eq('is_flagged', true)
  }

  if (protectedOnly) {
    countQuery = countQuery.eq('is_protected', true)
  }

  if (language && language !== 'all') {
    countQuery = countQuery.eq('patient_language', language)
  }

  if (search) {
    countQuery = countQuery.ilike('session_title', `%${search}%`)
  }

  const { count } = await countQuery

  return new Response(
    JSON.stringify({
      sessions: sessions || [],
      totalCount: count || 0,
      hasMore: (offset + limit) < (count || 0)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
async function handleUpdate(
  supabase: any,
  user: any,
  params: any,
  corsHeaders: Record<string, string>
) {
  const { sessionId, updates } = params

  if (!sessionId) {
    throw new Error('Session ID is required')
  }

  const allowedUpdates = ['is_flagged', 'is_protected', 'session_title']
  const filteredUpdates: any = {}

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = value
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw new Error('No valid updates provided')
  }

  filteredUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('translation_sessions')
    .update(filteredUpdates)
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
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
async function handleDelete(
  supabase: any,
  user: any,
  params: any,
  corsHeaders: Record<string, string>
) {
  const { sessionId } = params

  if (!sessionId) {
    throw new Error('Session ID is required')
  }

  // Check if session is protected
  const { data: session, error: fetchError } = await supabase
    .from('translation_sessions')
    .select('is_protected, session_title')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw new Error('Session not found')

  if (session.is_protected) {
    throw new Error('Cannot delete protected session')
  }

  const { error } = await supabase
    .from('translation_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) throw error

  return new Response(
    JSON.stringify({
      success: true,
      message: `Translation session "${session.session_title}" deleted successfully`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ─── CLEAR ───────────────────────────────────────────────────────────────────
async function handleClear(
  supabase: any,
  user: any,
  corsHeaders: Record<string, string>
) {
  const { data: deletedSessions, error } = await supabase
    .from('translation_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('is_protected', false)
    .select('id, session_title')

  if (error) throw error

  const deletedCount = deletedSessions?.length || 0

  return new Response(
    JSON.stringify({
      success: true,
      deletedCount,
      message: `Successfully cleared ${deletedCount} session(s). Protected sessions were preserved.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
