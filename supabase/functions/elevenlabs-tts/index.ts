import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { text, languageCode } = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map language codes to appropriate ElevenLabs voices
    const voiceMap: Record<string, string> = {
      'en': '9BWtsMINqrJLrRacOk9x', // Aria (English)
      'fr': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'es': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'de': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'it': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'pt': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'nl': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'ru': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'zh': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'ar': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'hi': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
      'tr': '9BWtsMINqrJLrRacOk9x', // Aria (multilingual)
    }

    const voiceId = voiceMap[languageCode] || '9BWtsMINqrJLrRacOk9x' // Default to Aria

    // Call ElevenLabs TTS API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2", // High-quality multilingual model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the audio data as bytes
    const audioBytes = await response.arrayBuffer()
    
    // Convert to base64 for JSON response
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBytes)))

    return new Response(
      JSON.stringify({ audioData: base64Audio }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})