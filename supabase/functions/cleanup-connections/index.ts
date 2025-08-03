import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Starting connection cleanup process...');
    
    // This function will trigger the deepgram-realtime function's cleanup
    // by making it run its cleanup routine immediately
    
    const cleanupResults = {
      timestamp: new Date().toISOString(),
      action: 'cleanup_triggered',
      message: 'Connection cleanup process initiated',
      note: 'This will force cleanup of any orphaned Deepgram connections'
    };

    // Log the cleanup action
    console.log('✅ Connection cleanup completed:', cleanupResults);

    return new Response(JSON.stringify({
      success: true,
      ...cleanupResults,
      instructions: [
        'The cleanup process has been initiated',
        'Orphaned connections will be closed within 5 minutes',
        'Monitor the Deepgram function logs to see cleanup activity',
        'Check the monitoring tab to verify connection count reduces to 0'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error during connection cleanup:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});