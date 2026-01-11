import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, language = 'en', voice = 'Sarah', voiceId: directVoiceId } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenlabsApiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Voice ID mapping for ElevenLabs voices (by name)
    const voiceIds: Record<string, string> = {
      'alloy': 'EXAVITQu4vr4xnSDxMaL', // Sarah
      'echo': '9BWtsMINqrJLrRacOk9x',  // Aria  
      'shimmer': 'FGY2WhTYpPnrIDTdsKH5', // Laura
      'sage': 'CwhRBWXzGAHq8TQ4Fs17',   // Roger
      'Sarah': 'EXAVITQu4vr4xnSDxMaL',
      'Aria': '9BWtsMINqrJLrRacOk9x',
      'Roger': 'CwhRBWXzGAHq8TQ4Fs17',
      'Laura': 'FGY2WhTYpPnrIDTdsKH5',
      'Charlie': 'IKne3meq5aSn9XLyUdCD',
      'George': 'JBFqnCBsd6RMkjVDRZzb',
      'Alice': 'Xb7hH8MSUJpSbSDYk0k2',
      'Lily': 'pFZP5JQG7iQjIQuC4Bku',
      'Matilda': 'XrExE9yKIg1WjnnlVkGX',
      'Jessica': 'cgSgspJ2msm6clMCkdW9',
      'Brian': 'nPczCjzI2devNBz1zQrb',
      'Daniel': 'onwK4e9ZLuTAKqWW03F9',
      'Will': 'bIHbv24MWmeRgasZH58o',
      'Chris': 'iP95p4xoKVk53GoZ742B',
      'Callum': 'N2lVS1w4EtoT3dr4eOWO',
    }

    // Use direct voiceId if provided, otherwise look up by name
    const voiceId = directVoiceId || voiceIds[voice] || voiceIds['Sarah']

    // Generate speech using ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2', // Supports multiple languages
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    // Convert audio to base64 (handle large arrays to avoid stack overflow)
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Process in chunks to avoid "Maximum call stack size exceeded"
    let binaryString = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize)
      binaryString += String.fromCharCode(...chunk)
    }
    const base64Audio = btoa(binaryString)

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: voice,
        language: language
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Text-to-speech error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})