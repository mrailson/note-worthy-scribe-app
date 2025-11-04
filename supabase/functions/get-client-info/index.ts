import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract client information from headers
    const headers = req.headers;
    
    // Try multiple header sources for IP address (different proxies use different headers)
    const ip_address = 
      headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      headers.get('x-real-ip') ||
      headers.get('cf-connecting-ip') ||
      headers.get('true-client-ip') ||
      'unknown';
    
    // Get user agent
    const user_agent = headers.get('user-agent') || 'unknown';
    
    // Get other useful headers
    const accept_language = headers.get('accept-language') || 'unknown';
    const referer = headers.get('referer') || null;
    
    // Try to extract country from Cloudflare headers if available
    const country = headers.get('cf-ipcountry') || null;
    
    console.log('📍 Client info request:', {
      ip: ip_address,
      country: country,
      user_agent: user_agent.substring(0, 50) + '...'
    });
    
    return new Response(
      JSON.stringify({
        ip_address,
        country,
        geographic_location: country,
        headers: {
          user_agent,
          accept_language,
          referer
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Error in get-client-info:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: 'unknown'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
