import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Thin wrapper — redirects to translation-session-manager
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body = {}
  try { body = await req.json() } catch { /* no body is fine for clear */ }
  const url = new URL(req.url)
  const baseUrl = url.origin

  const response = await fetch(`${baseUrl}/translation-session-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('Authorization') || '',
      'apikey': req.headers.get('apikey') || '',
    },
    body: JSON.stringify({ action: 'clear', ...body }),
  })

  const data = await response.text()
  return new Response(data, {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
