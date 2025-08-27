const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_type, severity = 'medium', event_details = {} } = await req.json();

    // Get user information from request headers
    const authHeader = req.headers.get('Authorization');
    const userAgent = req.headers.get('User-Agent');
    const clientInfo = req.headers.get('x-client-info');

    // Extract IP address from various possible headers
    const getClientIP = (request: Request): string | null => {
      const headers = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip',
      ];
      
      for (const header of headers) {
        const value = request.headers.get(header);
        if (value) {
          return value.split(',')[0].trim();
        }
      }
      
      return null;
    };

    const ipAddress = getClientIP(req);

    // Log the security event with enhanced details
    const enhancedEventDetails = {
      ...event_details,
      user_agent: userAgent,
      client_info: clientInfo,
      ip_address: ipAddress,
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
    };

    console.log(`Security Event [${severity.toUpperCase()}]: ${event_type}`, enhancedEventDetails);

    // For high and critical severity events, we could trigger additional actions
    if (severity === 'high' || severity === 'critical') {
      console.warn(`CRITICAL SECURITY EVENT: ${event_type}`, enhancedEventDetails);
      
      // In a production environment, you might want to:
      // - Send alerts to security team
      // - Trigger automated responses
      // - Update threat intelligence
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Security event logged successfully',
        event_id: enhancedEventDetails.request_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error logging security event:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to log security event',
        message: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});